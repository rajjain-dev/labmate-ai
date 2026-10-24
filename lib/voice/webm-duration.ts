/**
 * Derive timing from browser WebM/Opus packets when the streaming container has
 * no Duration element. This deliberately supports one unencrypted audio track
 * and un-laced blocks; unfamiliar layouts fail closed instead of guessing.
 */
export function deriveWebmOpusDuration(bytes: Uint8Array): number | undefined {
  try {
    return new WebmTiming(bytes).duration();
  } catch {
    return undefined;
  }
}

interface Element {
  id: number;
  start: number;
  end: number;
  unknown: boolean;
}
interface Block {
  start: number;
  end: number;
  timestamp: number;
  duration?: number;
}

const SEGMENT_CHILDREN = new Set([
  0x114d9b74, 0x1549a966, 0x1654ae6b, 0x1f43b675,
  0x1c53bb6b, 0x1941a469, 0x1043a770, 0x1254c367,
]);

class WebmTiming {
  private readonly view: DataView;
  private remainingElements = 50_000;
  private blocks: Block[] = [];
  private scale = 1_000_000;
  private track?: number;
  private sawInfo = false;
  private sawTracks = false;

  constructor(private readonly bytes: Uint8Array) {
    if (bytes.length === 0 || bytes.length > 5 * 1024 * 1024) throw new Error("Audio size");
    this.view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  }

  private vint(offset: number, end: number, id = false): { value: number; end: number; unknown: boolean } {
    if (offset >= end || this.bytes[offset] === 0) throw new Error("Invalid EBML integer");
    const first = this.bytes[offset];
    let width = 1;
    let marker = 0x80;
    while (!(first & marker)) { width++; marker >>= 1; }
    if (width > (id ? 4 : 8) || offset + width > end) throw new Error("Truncated EBML integer");
    let value = BigInt(id ? first : first & (marker - 1));
    let unknown = !id && (first & (marker - 1)) === marker - 1;
    for (let index = 1; index < width; index++) {
      const byte = this.bytes[offset + index];
      value = value * 256n + BigInt(byte);
      unknown = unknown && byte === 255;
    }
    if (!unknown && value > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error("Unsafe EBML integer");
    return { value: unknown ? 0 : Number(value), end: offset + width, unknown };
  }

  private element(offset: number, limit: number): Element {
    if (--this.remainingElements < 0) throw new Error("Too many elements");
    const id = this.vint(offset, limit, true);
    const size = this.vint(id.end, limit);
    const end = size.unknown ? limit : size.end + size.value;
    if (end > limit || end < size.end) throw new Error("Truncated element");
    if (size.unknown && id.value !== 0x18538067 && id.value !== 0x1f43b675) throw new Error("Unsupported unknown size");
    return { id: id.value, start: size.end, end, unknown: size.unknown };
  }

  private uint(element: Element): number {
    if (element.end <= element.start || element.end - element.start > 8) throw new Error("Invalid integer");
    let value = 0;
    for (let index = element.start; index < element.end; index++) {
      value = value * 256 + this.bytes[index];
      if (!Number.isSafeInteger(value)) throw new Error("Unsafe integer");
    }
    return value;
  }

  private text(element: Element): string {
    if (element.end - element.start > 32) throw new Error("Unsupported text");
    return new TextDecoder("utf-8", { fatal: true }).decode(this.bytes.subarray(element.start, element.end));
  }

  private children(element: Element, visit: (child: Element) => void): void {
    for (let offset = element.start; offset < element.end;) {
      const child = this.element(offset, element.end);
      if (child.unknown) throw new Error("Unsupported nested unknown size");
      visit(child);
      offset = child.end;
    }
  }

  private info(element: Element): void {
    if (this.sawInfo) throw new Error("Duplicate Info");
    this.sawInfo = true;
    let sawScale = false;
    this.children(element, child => {
      if (child.id === 0x2ad7b1) {
        if (sawScale) throw new Error("Duplicate scale");
        this.scale = this.uint(child);
        if (this.scale <= 0) throw new Error("Invalid scale");
        sawScale = true;
      }
    });
  }

  private tracks(element: Element): void {
    if (this.sawTracks) throw new Error("Duplicate Tracks");
    this.sawTracks = true;
    let entries = 0;
    this.children(element, entry => {
      if (entry.id !== 0xae) return;
      if (++entries > 1) throw new Error("Only one audio track supported");
      let number: number | undefined;
      let type: number | undefined;
      let codec: string | undefined;
      let privateData = false;
      const seen = new Set<number>();
      this.children(entry, child => {
        if ([0xd7, 0x83, 0x86, 0x63a2, 0x23314f].includes(child.id)) {
          if (seen.has(child.id)) throw new Error("Duplicate track field");
          seen.add(child.id);
        }
        if (child.id === 0xd7) number = this.uint(child);
        if (child.id === 0x83) type = this.uint(child);
        if (child.id === 0x86) codec = this.text(child);
        if (child.id === 0x6d80 || child.id === 0x537f) throw new Error("Encoded or shifted track");
        if (child.id === 0x23314f) {
          const size = child.end - child.start;
          const scale = size === 4 ? this.view.getFloat32(child.start) : size === 8 ? this.view.getFloat64(child.start) : NaN;
          if (scale !== 1) throw new Error("Unsupported track scale");
        }
        if (child.id === 0x63a2) {
          privateData = child.end - child.start >= 19
            && new TextDecoder().decode(this.bytes.subarray(child.start, child.start + 8)) === "OpusHead"
            && this.bytes[child.start + 8] <= 15
            && this.bytes[child.start + 9] > 0;
          if (!privateData) throw new Error("Invalid Opus initialization");
        }
      });
      if (!number || type !== 2 || codec !== "A_OPUS" || !privateData) throw new Error("Unsupported track");
      this.track = number;
    });
    if (entries !== 1) throw new Error("Missing audio track");
  }

  private cluster(element: Element): number {
    let timestamp: number | undefined;
    const pending: Omit<Block, "timestamp">[] = [];
    let offset = element.start;
    while (offset < element.end) {
      const child = this.element(offset, element.end);
      if (SEGMENT_CHILDREN.has(child.id)) {
        if (!element.unknown) throw new Error("Nested segment element");
        break;
      }
      if (child.unknown) throw new Error("Unknown cluster child");
      if (child.id === 0xe7) {
        if (timestamp !== undefined) throw new Error("Duplicate cluster timestamp");
        timestamp = this.uint(child);
      } else if (child.id === 0xa3) {
        pending.push({ start: child.start, end: child.end });
      } else if (child.id === 0xa0) {
        let block: Element | undefined;
        let duration: number | undefined;
        this.children(child, item => {
          if (item.id === 0xa1) {
            if (block) throw new Error("Duplicate block");
            block = item;
          } else if (item.id === 0x9b) {
            if (duration !== undefined) throw new Error("Duplicate block duration");
            duration = this.uint(item);
          }
        });
        if (!block) throw new Error("Missing block");
        pending.push({ start: block.start, end: block.end, duration });
      } else if (child.id === 0xaf) {
        throw new Error("Encrypted block");
      }
      if (pending.length + this.blocks.length > 20_000) throw new Error("Too many blocks");
      offset = child.end;
    }
    if (pending.length && timestamp === undefined) throw new Error("Missing timestamp");
    for (const block of pending) this.blocks.push({ ...block, timestamp: timestamp ?? 0 });
    return offset;
  }

  duration(): number {
    let segment: Element | undefined;
    let sawHeader = false;
    for (let offset = 0; offset < this.bytes.length;) {
      const element = this.element(offset, this.bytes.length);
      if (element.id === 0x1a45dfa3 && !sawHeader && !segment) sawHeader = true;
      else if (element.id === 0x18538067 && sawHeader && !segment) segment = element;
      else if (element.id !== 0xec && element.id !== 0xbf) throw new Error("Unsupported WebM structure");
      offset = element.end;
    }
    if (!segment) throw new Error("Missing segment");
    for (let offset = segment.start; offset < segment.end;) {
      const element = this.element(offset, segment.end);
      if (element.id === 0x1f43b675) offset = this.cluster(element);
      else {
        if (element.unknown) throw new Error("Unsupported segment element");
        if (element.id === 0x1549a966) this.info(element);
        if (element.id === 0x1654ae6b) this.tracks(element);
        offset = element.end;
      }
    }
    if (!this.track || !this.blocks.length) throw new Error("Missing audio packets");
    let minimum = 0;
    let maximum = 0;
    let packetTotal = 0;
    for (const block of this.blocks) {
      const track = this.vint(block.start, block.end);
      if (track.unknown || track.value !== this.track || track.end + 3 >= block.end) throw new Error("Invalid audio block");
      const relative = this.view.getInt16(track.end);
      if (this.bytes[track.end + 2] & 0x06) throw new Error("Laced blocks unsupported");
      const packetDuration = opusDuration(this.bytes.subarray(track.end + 3, block.end));
      const timestamp = (block.timestamp + relative) * this.scale / 1e9;
      const duration = Math.max(packetDuration, (block.duration ?? 0) * this.scale / 1e9);
      if (!Number.isFinite(timestamp) || !Number.isFinite(duration)) throw new Error("Unsafe audio timing");
      minimum = Math.min(minimum, timestamp);
      maximum = Math.max(maximum, timestamp + duration);
      packetTotal += duration;
    }
    const duration = Math.max(maximum - minimum, packetTotal);
    if (!Number.isFinite(duration) || duration <= 0) throw new Error("Missing audio duration");
    return duration;
  }
}

/** Opus TOC/frame framing: https://www.rfc-editor.org/rfc/rfc6716.html#section-3 */
function opusDuration(packet: Uint8Array): number {
  if (packet.length === 0) throw new Error("Empty Opus packet");
  const config = packet[0] >> 3;
  const frameMilliseconds = config < 12 ? [10, 20, 40, 60][config & 3]
    : config < 16 ? [10, 20][config & 1] : [2.5, 5, 10, 20][config & 3];
  const code = packet[0] & 3;
  let count = code === 0 ? 1 : 2;
  let offset = 1;
  let end = packet.length;
  const frameLength = (): number => {
    if (offset >= end) throw new Error("Truncated Opus frame size");
    const first = packet[offset++];
    if (first < 252) return first;
    if (offset >= end) throw new Error("Truncated Opus frame size");
    return first + 4 * packet[offset++];
  };
  const validFrame = (size: number): void => {
    if (size < 0 || size > 1275) throw new Error("Invalid Opus frame size");
  };
  if (code === 0) validFrame(end - offset);
  else if (code === 1) {
    if ((end - offset) % 2) throw new Error("Invalid Opus CBR packet");
    validFrame((end - offset) / 2);
  } else if (code === 2) {
    const first = frameLength();
    validFrame(first);
    validFrame(end - offset - first);
  } else {
    if (offset >= end) throw new Error("Truncated Opus packet");
    const flags = packet[offset++];
    count = flags & 0x3f;
    if (!count || count * frameMilliseconds > 120) throw new Error("Invalid Opus frame count");
    if (flags & 0x40) {
      let padding = 0;
      let value: number;
      do {
        if (offset >= end) throw new Error("Truncated Opus padding");
        value = packet[offset++];
        padding += value === 255 ? 254 : value;
        if (padding > end - offset) throw new Error("Invalid Opus padding");
      } while (value === 255);
      end -= padding;
    }
    if (flags & 0x80) {
      let consumed = 0;
      for (let index = 1; index < count; index++) {
        const size = frameLength();
        validFrame(size);
        consumed += size;
      }
      validFrame(end - offset - consumed);
    } else {
      if ((end - offset) % count) throw new Error("Invalid Opus CBR packet");
      validFrame((end - offset) / count);
    }
  }
  if (count * frameMilliseconds > 120) throw new Error("Opus packet too long");
  return count * frameMilliseconds / 1000;
}
