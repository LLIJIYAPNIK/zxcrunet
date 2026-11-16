"""Blank video metadata in place: tags become empty padding of the same length.

Phones write the shooting location, device and author into MP4 `udta`/`meta` boxes and
WebM `Tags`. We do not re-encode videos, so instead of cutting those parts out (which would
shift the sample offsets the player relies on) each one is turned into padding the format
already defines — an MP4 `free` box, a Matroska `Void` element — and its bytes are zeroed.
Anything that does not parse is left alone: the walk stops, the video still plays.
"""

MP4_HEADER = 8
MP4_LARGE_HEADER = 16
#: Boxes that hold other boxes on the way to the tags.
MP4_CONTAINERS = frozenset({b"moov", b"trak", b"mdia", b"minf", b"edts"})
#: User data, iTunes-style metadata and vendor boxes (XMP lives in a `uuid` box).
MP4_METADATA = frozenset({b"udta", b"meta", b"uuid"})
MAX_DEPTH = 8


def blank_mp4_metadata(data: bytes) -> bytes:
    out = bytearray(data)

    def walk(start: int, end: int, depth: int) -> None:
        pos = start
        while pos + MP4_HEADER <= end:
            size = int.from_bytes(out[pos : pos + 4], "big")
            kind = bytes(out[pos + 4 : pos + 8])
            header = MP4_HEADER
            if size == 1:  # 64-bit size follows the type
                if pos + MP4_LARGE_HEADER > end:
                    return
                size = int.from_bytes(out[pos + 8 : pos + 16], "big")
                header = MP4_LARGE_HEADER
            elif size == 0:  # runs to the end of the parent
                size = end - pos
            if size < header or pos + size > end:
                return
            if kind in MP4_METADATA:
                out[pos + 4 : pos + 8] = b"free"
                out[pos + header : pos + size] = bytes(size - header)
            elif kind in MP4_CONTAINERS and depth < MAX_DEPTH:
                walk(pos + header, pos + size, depth + 1)
            pos += size

    walk(0, len(out), 0)
    return bytes(out)


EBML_SEGMENT = 0x18538067
EBML_TAGS = 0x1254C367
EBML_VOID = 0xEC
#: A Void element written with an 8-byte size: 1 (id) + 8 (size).
VOID_HEADER = 9
MAX_VINT = 8


def _vint(data: bytearray | bytes, pos: int) -> tuple[int, int, bool] | None:
    """(value without the length marker, length, all value bits set = «unknown size»)."""
    if pos >= len(data) or data[pos] == 0:
        return None
    first = data[pos]
    length = 1
    while not first & (0x80 >> (length - 1)):
        length += 1
    if length > MAX_VINT or pos + length > len(data):
        return None
    value = first & (0xFF >> length)
    for byte in data[pos + 1 : pos + length]:
        value = (value << 8) | byte
    return value, length, value == (1 << (7 * length)) - 1


def _element_id(data: bytearray | bytes, pos: int) -> tuple[int, int] | None:
    """An element id keeps its length marker: 0x1A45DFA3 stays 0x1A45DFA3."""
    parsed = _vint(data, pos)
    if parsed is None:
        return None
    length = parsed[1]
    return int.from_bytes(data[pos : pos + length], "big"), length


def _element(data: bytearray, pos: int) -> tuple[int, int, int, bool] | None:
    """(id, header length, payload size, unknown size) of the element at `pos`."""
    ident = _element_id(data, pos)
    if ident is None:
        return None
    size = _vint(data, pos + ident[1])
    if size is None:
        return None
    return ident[0], ident[1] + size[1], size[0], size[2]


def blank_webm_metadata(data: bytes) -> bytes:
    out = bytearray(data)
    pos = 0
    while pos < len(out):
        found = _element(out, pos)
        if found is None:
            break
        ident, header, size, unknown = found
        if ident == EBML_SEGMENT:
            _blank_segment_tags(out, pos + header, len(out) if unknown else pos + header + size)
            break
        if unknown:
            break
        pos += header + size
    return bytes(out)


def _blank_segment_tags(out: bytearray, start: int, end: int) -> None:
    pos = start
    while pos < end:
        found = _element(out, pos)
        if found is None:
            return
        ident, header, size, unknown = found
        total = header + size
        if unknown or pos + total > end:
            # A cluster of unknown size runs to the end: nothing after it can be walked.
            return
        if ident == EBML_TAGS and total >= VOID_HEADER:
            out[pos] = EBML_VOID
            out[pos + 1 : pos + VOID_HEADER] = (0x01 << 56 | (total - VOID_HEADER)).to_bytes(
                MAX_VINT, "big"
            )
            out[pos + VOID_HEADER : pos + total] = bytes(total - VOID_HEADER)
        pos += total


class TagStrippingVideoCleaner:
    def strip_metadata(self, data: bytes, mime: str) -> bytes:
        if mime == "video/mp4":
            return blank_mp4_metadata(data)
        if mime == "video/webm":
            return blank_webm_metadata(data)
        return data
