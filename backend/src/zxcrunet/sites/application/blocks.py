"""Block registry: one Pydantic schema per block type and version.

The frontend mirrors every schema in zod (`frontend/src/blocks`). The backend is the
authority: blocks are validated here before they reach the draft.
"""

from typing import Annotated, Any, Literal
from uuid import UUID

from pydantic import (
    BaseModel,
    ConfigDict,
    Field,
    StringConstraints,
    ValidationError,
    field_validator,
    model_validator,
)

from zxcrunet.shared.application.content import (
    ContentModel as _Model,
)
from zxcrunet.shared.application.content import (
    Embed,
    Line,
    Link,
    MediaRef,
    Short,
    Text,
    Url,
    VideoRef,
    safe_url,
)
from zxcrunet.shared.application.content import (
    media_ids as _media_ids,
)
from zxcrunet.shared.domain.errors import InvalidInputError

MAX_BLOCKS_PER_PAGE = 40

TitleKind = Literal["game", "book", "anime", "series", "film"]
ALL_KINDS: tuple[TitleKind, ...] = ("game", "book", "anime", "series", "film")

# Background decoration of the profile card (hero) and the personal cover (profile).
Pattern = Literal[
    "rings", "glow", "dots", "grid", "diagonal", "plus", "waves", "circuit", "topo",
    "lattice", "arches", "crosses", "stars", "none",
]  # fmt: skip


class InvalidBlockError(InvalidInputError):
    code = "invalid_block"


# --- section appearance (any block) -------------------------------------------

#: Mirror of `sites.domain.site.FONTS` (a unit test keeps them equal).
FontId = Literal[
    "onest", "inter", "manrope", "golos", "unbounded", "russo", "dela-gothic", "tektur",
    "cormorant", "playfair", "eb-garamond", "lora", "pt-serif", "old-standard", "yeseva",
    "prata", "ruslan", "monomakh", "rubik-glitch", "rubik-wet-paint", "caveat", "marck",
    "jetbrains", "ibm-plex-mono", "press-start", "pixelify", "poiret",
]  # fmt: skip
#: Mirror of `sites.domain.site.BODY_FONTS`.
BodyFontId = Literal[
    "onest", "inter", "manrope", "golos", "cormorant", "eb-garamond", "lora", "pt-serif",
    "old-standard", "jetbrains", "ibm-plex-mono",
]  # fmt: skip
Hex = Annotated[
    str, StringConstraints(strip_whitespace=True, to_lower=True, pattern=r"^#[0-9a-fA-F]{6}$")
]
SectionBackground = Literal[
    "none", "surface", "accent", "color", "gradient", "image", "video", "pattern"
]  # fmt: skip
SectionSpace = Literal["none", "s", "m", "l"]
SectionDivider = Literal["none", "line", "ornament"]


class Appearance(_Model):
    """How a section looks around its content: background, room, divider, fonts."""

    background: SectionBackground = "none"
    #: `color`: the fill; `gradient`: from `color` to `color2` at `angle` degrees.
    color: Hex = "#121722"
    color2: Hex = "#05070b"
    angle: int = Field(default=180, ge=0, le=360)
    image: MediaRef | None = None
    #: `video`: a short muted loop behind the content (`image` is its poster).
    video: VideoRef | None = None
    #: Darkening over the image or video, in percent, so the text stays readable.
    dim: int = Field(default=45, ge=0, le=90)
    pattern: Pattern = "dots"
    space: SectionSpace = "none"
    divider: SectionDivider = "none"
    #: Empty: the site's fonts.
    heading_font: FontId | Literal[""] = ""
    body_font: BodyFontId | Literal[""] = ""


# --- business blocks ----------------------------------------------------------


class HeroSettings(_Model):
    label: Short = ""
    title: Line
    lead: Text = ""
    primary: Link | None = None
    secondary: Link | None = None
    card_name: Short = ""
    card_role: Short = ""
    avatar: MediaRef | None = None
    chips: list[Short] = Field(default_factory=list, max_length=6)
    pattern: Pattern = "rings"
    #: `card`: text and the profile card; `collage`: text and up to six pictures or clips;
    #: `fullscreen`: text over a picture or clip that fills the first screen.
    layout: Literal["card", "collage", "fullscreen"] = "card"
    media: list[MediaRef] = Field(default_factory=list, max_length=6)
    background: MediaRef | None = None
    #: Darkening over the fullscreen background, in percent.
    dim: int = Field(default=45, ge=0, le=90)
    align: Literal["left", "center"] = "left"


class Fact(_Model):
    value: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=16)]
    label: Line


class FactsSettings(_Model):
    items: list[Fact] = Field(min_length=1, max_length=10)


class ExperienceItem(_Model):
    title: Short
    text: Text = ""
    current: bool = False


class ExperienceSettings(_Model):
    label: Short = ""
    title: Line = ""
    items: list[ExperienceItem] = Field(min_length=1, max_length=20)


class Project(_Model):
    label: Short = ""
    title: Short
    text: Text = ""
    tags: list[Short] = Field(default_factory=list, max_length=8)
    link: Link | None = None


class ProjectsSettings(_Model):
    label: Short = ""
    title: Line = ""
    all_link: Link | None = None
    items: list[Project] = Field(min_length=1, max_length=12)


class InterestsSettings(_Model):
    label: Short = ""
    items: list[Short] = Field(min_length=1, max_length=24)


Grade = Literal["", "intern", "junior", "middle", "senior", "lead", "expert"]


class Skill(_Model):
    name: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=40)]
    #: Professional grade; empty means «not shown».
    grade: Grade = ""
    #: Self-assessment for the progress bar, 0 hides the bar.
    level: int = Field(default=0, ge=0, le=100)
    #: A short note: «5 лет», «FastAPI, Django».
    note: Short = ""


class StackSettings(_Model):
    label: Short = ""
    title: Line = ""
    items: list[Skill] = Field(min_length=1, max_length=24)


ContactKind = Literal["telegram", "github", "email", "phone", "vk", "linkedin", "website"]


class Contact(_Model):
    kind: ContactKind
    label: Short
    value: Short
    url: Url

    @field_validator("url")
    @classmethod
    def _safe(cls, value: str) -> str:
        return safe_url(value)


class ContactsSettings(_Model):
    title: Line
    title_muted: Short = ""
    items: list[Contact] = Field(min_length=1, max_length=8)


class ResumeSettings(_Model):
    label: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=80)]
    #: None until the PDF is uploaded; such a block renders nothing.
    file: MediaRef | None = None


# --- personal blocks ----------------------------------------------------------
# Shelves, «now», characters and posts come from the owner's catalog when the page is
# rendered; blocks keep only presentation and references (title ids) to it.

Required = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=80)]


class ProfileSettings(_Model):
    cover: MediaRef | None = None
    avatar: MediaRef | None = None
    title: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=160)]
    lead: Text = ""
    mood: Short = ""
    pattern: Pattern = "glow"


class NowSettings(_Model):
    label: Short = ""
    kinds: list[TitleKind] = Field(
        default_factory=lambda: list(ALL_KINDS),
        min_length=1,
        max_length=5,
    )
    limit: int = Field(default=3, ge=1, le=6)


ShelfStyle = Literal["cards", "bento", "spines", "tickets", "tracker"]


class ShelfSettings(_Model):
    kind: TitleKind
    style: ShelfStyle = "cards"
    label: Short = ""
    title: Line = ""
    lead: Text = ""
    #: Status filters, sorting and views for guests (their choice is remembered).
    controls: bool = False
    limit: int = Field(default=12, ge=1, le=60)
    all_link: Link | None = None


class CharactersSettings(_Model):
    label: Short = ""
    title: Line = ""


class TopSettings(_Model):
    label: Short = ""
    title: Line = ""
    items: list[UUID] = Field(min_length=1, max_length=10)


class ChallengeSettings(_Model):
    label: Short = ""
    kind: TitleKind = "book"
    year: int = Field(ge=2000, le=2100)
    goal: int = Field(ge=1, le=1000)


class Quote(_Model):
    text: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=1200)]
    source: Line = ""
    title_id: UUID | None = None


class QuotesSettings(_Model):
    label: Short = ""
    title: Line = ""
    items: list[Quote] = Field(min_length=1, max_length=20)


class PlaylistTrack(_Model):
    track: Required
    artist: Short = ""
    title_id: UUID | None = None
    url: Url | None = None

    @field_validator("url")
    @classmethod
    def _safe(cls, value: str | None) -> str | None:
        return safe_url(value) if value else None


class PlaylistSettings(_Model):
    label: Short = ""
    title: Line = ""
    lead: Text = ""
    items: list[PlaylistTrack] = Field(min_length=1, max_length=30)


class PostsSettings(_Model):
    label: Short = ""
    title: Line = ""
    kind: Literal["all", "review", "note"] = "all"
    limit: int = Field(default=6, ge=1, le=24)


# --- media blocks (any site) -------------------------------------------------

Aspect = Literal["16:9", "9:16", "4:3", "1:1", "21:9"]


class VideoSettings(_Model):
    label: Short = ""
    title: Line = ""
    lead: Text = ""
    #: `embed`: YouTube, VK Video or Rutube; `file`: an uploaded clip.
    source: Literal["embed", "file"] = "embed"
    embed: Embed | None = None
    file: VideoRef | None = None
    poster: MediaRef | None = None
    #: For files: a player with controls, or a silent endless loop.
    mode: Literal["player", "loop"] = "player"
    aspect: Aspect = "16:9"


class CarouselItem(_Model):
    media: MediaRef
    #: Read by screen readers; never shown under the picture.
    alt: Short = ""
    link: Link | None = None


class CarouselSettings(_Model):
    label: Short = ""
    title: Line = ""
    items: list[CarouselItem] = Field(default_factory=list, max_length=30)
    #: `slides`: one frame after another; `marquee`: a strip that runs without stopping.
    mode: Literal["slides", "marquee"] = "slides"
    autoplay: bool = True
    #: Seconds per slide.
    interval: int = Field(default=5, ge=2, le=15)
    #: Seconds per lap of the strip.
    speed: int = Field(default=40, ge=10, le=120)
    direction: Literal["left", "right"] = "left"
    height: Literal["s", "m", "l"] = "m"
    pause_on_hover: bool = True


# --- collage: tiles on a 12-column grid (4 columns on phones) ------------------

DESKTOP_COLUMNS = 12
PHONE_COLUMNS = 4
MAX_ROW = 60
MAX_SPAN_ROWS = 24


class Place(_Model):
    """Cell coordinates: `x`/`y` from the top-left corner, `w`×`h` cells."""

    x: int = Field(ge=0, lt=DESKTOP_COLUMNS)
    y: int = Field(ge=0, lt=MAX_ROW)
    w: int = Field(ge=1, le=DESKTOP_COLUMNS)
    h: int = Field(ge=1, le=MAX_SPAN_ROWS)


class CollageTile(_Model):
    id: Annotated[str, StringConstraints(pattern=r"^[a-z0-9]{1,16}$")]
    kind: Literal["image", "video", "embed", "audio", "text", "button"]
    #: `image`: a picture; `video`: an uploaded clip (always a silent loop).
    media: MediaRef | None = None
    embed: Embed | None = None
    audio_url: Annotated[str, StringConstraints(strip_whitespace=True, max_length=500)] | None = (
        None
    )
    audio_title: Short = ""
    audio_artist: Short = ""
    audio_animation: Literal["none", "equalizer", "vinyl"] = "equalizer"
    audio_progress: Literal["line", "wave", "segments"] = "line"
    audio_color: Hex = "#b8ff3b"
    audio_background: Hex = "#171a20"
    text: Text = ""
    text_style: Literal["heading", "body", "quote", "label"] = "body"
    text_font: FontId | None = None
    text_size: int | None = Field(default=None, ge=10)
    text_color: Hex | None = None
    align: Literal["left", "center", "right"] = "left"
    #: `button`: the button itself; `image`/`video`: where a click leads.
    link: Link | None = None
    #: Behind the text of a text or button tile.
    fill: Literal["none", "surface", "accent"] = "none"
    fit: Literal["cover", "contain"] = "cover"
    rounded: bool = True
    #: Read by screen readers.
    alt: Short = ""
    desktop: Place
    #: Ignored while the collage lays itself out on phones (`CollageSettings.phone`).
    phone: Place | None = None
    #: Higher layers cover lower ones where tiles overlap.
    layer: int = Field(default=1, ge=0, le=10)

    @field_validator("audio_url")
    @classmethod
    def _audio_url_safe(cls, value: str | None) -> str | None:
        if value is not None and not value.startswith(("https://", "http://")):
            raise ValueError("audio URL must use HTTP or HTTPS")
        return value

    @model_validator(mode="after")
    def _fits(self) -> "CollageTile":
        if self.desktop.x + self.desktop.w > DESKTOP_COLUMNS:
            msg = "tile is wider than the grid"
            raise ValueError(msg)
        if self.phone and self.phone.x + self.phone.w > PHONE_COLUMNS:
            msg = "tile is wider than the phone grid"
            raise ValueError(msg)
        return self


class CollageSettings(_Model):
    label: Short = ""
    title: Line = ""
    tiles: list[CollageTile] = Field(default_factory=list, max_length=24)
    #: Height of one grid row.
    cell: Literal["s", "m", "l"] = "m"
    gap: Literal["none", "s", "m"] = "s"
    #: `auto`: tiles stack in reading order; `custom`: each tile's `phone` place.
    phone: Literal["auto", "custom"] = "auto"
    #: Stretch past the content width to the screen edges.
    bleed: bool = False

    @field_validator("tiles")
    @classmethod
    def _unique_ids(cls, tiles: list[CollageTile]) -> list[CollageTile]:
        if len({t.id for t in tiles}) != len(tiles):
            msg = "tile ids must be unique"
            raise ValueError(msg)
        return tiles


SCHEMAS: dict[str, dict[int, type[_Model]]] = {
    "hero": {1: HeroSettings},
    "facts": {1: FactsSettings},
    "experience": {1: ExperienceSettings},
    "projects": {1: ProjectsSettings},
    "interests": {1: InterestsSettings},
    "stack": {1: StackSettings},
    "contacts": {1: ContactsSettings},
    "resume": {1: ResumeSettings},
    "profile": {1: ProfileSettings},
    "now": {1: NowSettings},
    "shelf": {1: ShelfSettings},
    "characters": {1: CharactersSettings},
    "top": {1: TopSettings},
    "challenge": {1: ChallengeSettings},
    "quotes": {1: QuotesSettings},
    "playlist": {1: PlaylistSettings},
    "posts": {1: PostsSettings},
    "video": {1: VideoSettings},
    "carousel": {1: CarouselSettings},
    "collage": {1: CollageSettings},
}

BlockType = Literal[
    "hero",
    "facts",
    "experience",
    "projects",
    "interests",
    "stack",
    "contacts",
    "resume",
    "profile",
    "now",
    "shelf",
    "characters",
    "top",
    "challenge",
    "quotes",
    "playlist",
    "posts",
    "video",
    "carousel",
    "collage",
]


class BlockIn(BaseModel):
    """Envelope the editor sends; `settings` is checked against the type's schema."""

    model_config = ConfigDict(extra="forbid")

    id: UUID
    type: BlockType
    version: int = Field(default=1, ge=1)
    hidden: bool = False
    settings: dict[str, Any]
    appearance: Appearance | None = None


def _errors(exc: ValidationError) -> list[dict[str, Any]]:
    return [
        {"loc": [str(p) for p in err["loc"]], "msg": err["msg"], "type": err["type"]}
        for err in exc.errors()
    ]


COMMON_BLOCKS = frozenset({"hero", "interests", "contacts", "video", "carousel", "collage"})
PERSONAL_ONLY = frozenset(
    {"profile", "now", "shelf", "characters", "top", "challenge", "quotes", "playlist", "posts"}
)
BUSINESS_ONLY = frozenset(SCHEMAS) - COMMON_BLOCKS - PERSONAL_ONLY


def allowed_for(site_kind: str) -> frozenset[str]:
    """Block types a site of this kind may use (catalog blocks only on personal sites)."""
    return COMMON_BLOCKS | (PERSONAL_ONLY if site_kind == "personal" else BUSINESS_ONLY)


def validate_blocks(blocks: list[BlockIn], site_kind: str | None = None) -> list[dict[str, Any]]:
    """Validate and normalise; returns plain dicts ready to be stored."""
    if len(blocks) > MAX_BLOCKS_PER_PAGE:
        raise InvalidBlockError("Too many blocks", {"max": MAX_BLOCKS_PER_PAGE})
    if len({b.id for b in blocks}) != len(blocks):
        raise InvalidBlockError("Block ids must be unique")
    allowed = allowed_for(site_kind) if site_kind else frozenset(SCHEMAS)
    result: list[dict[str, Any]] = []
    for index, block in enumerate(blocks):
        if block.type not in allowed:
            raise InvalidBlockError(
                "Block is not available for this kind of site",
                {"index": index, "type": block.type},
            )
        schema = SCHEMAS[block.type].get(block.version)
        if schema is None:
            raise InvalidBlockError("Unknown block version", {"index": index, "type": block.type})
        try:
            settings = schema.model_validate(block.settings)
        except ValidationError as exc:
            raise InvalidBlockError(
                "Block settings are invalid",
                {"index": index, "type": block.type, "errors": _errors(exc)},
            ) from exc
        stored: dict[str, Any] = {
            "id": str(block.id),
            "type": block.type,
            "version": block.version,
            "hidden": block.hidden,
            "settings": settings.model_dump(mode="json"),
        }
        if block.appearance is not None and block.appearance != Appearance():
            stored["appearance"] = block.appearance.model_dump(mode="json")
        result.append(stored)
    return result


def media_ids(blocks: list[dict[str, Any]]) -> set[UUID]:
    """Every uploaded file a list of validated blocks refers to."""
    return _media_ids([[b["settings"], b.get("appearance")] for b in blocks])
