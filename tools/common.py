"""Shared helpers + page shell for the IMRC static site generator."""
import json
from html import escape
from pathlib import Path

SITE = Path(__file__).resolve().parent.parent / "site"
BASE_URL = "https://culturalresilience.org"
LANGS = ["en", "ko", "ja"]
LANG_LABEL = {"en": "EN", "ko": "한국어", "ja": "日本語"}
PRIVATE_PRACTICE_URL = "https://torontomindfulness.com"
JANE_URL = "#"  # TODO: Jane App online-booking URL (needs your input)

state = {"lang": "en"}

SRI = {   # Subresource Integrity for the pinned (immutable) CDN files: the browser refuses them if a single byte changes
    "dompurify": "sha384-JEyTNhjM6R1ElGoJns4U2Ln4ofPcqzSsynQkmEc/KGy6336qAZl70tDLufbkla+3",
    "supabase": "sha384-TcHRA3zBbn+Lexh5n+Oil4guNPOS3rjNDpGRAN46u/s/mB2IZ50ceC6TYDU2yvgK",
}
BLOG_SCRIPTS = ('<script src="/js/config.js"></script>\n'
                f'<script src="https://cdn.jsdelivr.net/npm/dompurify@3.2.6/dist/purify.min.js" integrity="{SRI["dompurify"]}" crossorigin="anonymous"></script>\n'
                f'<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.118.0/dist/umd/supabase.js" integrity="{SRI["supabase"]}" crossorigin="anonymous"></script>\n'
                '<script src="/js/blog.js" defer></script>')


def L():
    return state["lang"]


def t(en, ko=None, ja=None):
    l = L()
    if l == "ko" and ko is not None:
        return ko
    if l == "ja" and ja is not None:
        return ja
    return en


def u(path, lang=None):
    lang = lang or L()
    return ("" if lang == "en" else "/" + lang) + path


def eu(path):
    """Link to an English-only page; carry the visitor's language so a notice can be shown."""
    if L() == "en":
        return path
    base, _, frag = path.partition("#")
    return f"{base}?lang={L()}" + (f"#{frag}" if frag else "")


# ---------------------------------------------------------------- icons
_ICONS = {
    "arrow-right": '<path d="M5 12h14M13 6l6 6-6 6"/>',
    "arrow-up-right": '<path d="M7 17 17 7M8 7h9v9"/>',
    "menu": '<path d="M4 7h16M4 12h16M4 17h16"/>',
    "x": '<path d="M6 6l12 12M18 6 6 18"/>',
    "chevron-down": '<path d="m6 9 6 6 6-6"/>',
    "phone": '<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z"/>',
    "leaf": '<path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.5 19 2c1 2 2 4.2 2 8 0 5.5-4.8 10-10 10z"/><path d="M2 21c0-3 1.9-5.5 6-7"/>',
    "users": '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8"/>',
    "book": '<path d="M2 4h6a4 4 0 0 1 4 4v13a3 3 0 0 0-3-3H2z"/><path d="M22 4h-6a4 4 0 0 0-4 4v13a3 3 0 0 1 3-3h7z"/>',
    "message": '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
    "mail": '<rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-10 6L2 7"/>',
    "pin": '<path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 0 1 16 0z"/><circle cx="12" cy="10" r="3"/>',
    "instagram": '<rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><path d="M17.5 6.5h.01"/>',
    "linkedin": '<path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-4 0v7h-4v-7a6 6 0 0 1 6-6zM2 9h4v12H2z"/><circle cx="4" cy="4" r="2"/>',
    "facebook": '<path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/>',
    "plus": '<path d="M12 5v14M5 12h14"/>',
    "check": '<path d="M20 6 9 17l-5-5"/>',
    "info": '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/>',
    "compass": '<circle cx="12" cy="12" r="10"/><path d="m16 8-2 6-6 2 2-6z"/>',
}


def icon(name, cls="ic"):
    return (f'<svg class="{cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" '
            f'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">{_ICONS[name]}</svg>')


# ---------------------------------------------------------------- components
def btn(label, href, kind="dark", size="", ext=False):
    arr = icon("arrow-up-right" if ext else "arrow-right", "arr")
    new = (' target="_blank" rel="noopener noreferrer"' if ext else "")
    sr = f'<span class="sr"> {t("(opens in a new tab)", "(새 탭에서 열림)", "（新しいタブで開きます）")}</span>' if ext else ""
    cls = " ".join(x for x in ("btn", f"btn-{kind}", size) if x)
    return (f'<a class="{cls}" href="{href}"{new}><span>{label}{sr}</span>'
            f'<span class="arr-wrap">{arr}</span></a>')


def eyebrow(label):
    return f'<p class="eyebrow"><span class="dots" aria-hidden="true"><i></i><i></i><i></i></span>{label}</p>'


def todo(text):
    return f'<mark class="todo" lang="en" title="Needs your input">{text}</mark>'


def ph(label, ratio="4/5", pos="50% 50%", extra=""):
    return (f'<figure class="ph {extra}" style="--ratio:{ratio};--pos:{pos}" aria-hidden="true">'
            f'<figcaption lang="en">Photo needed: {label}</figcaption></figure>')


def _nm(n):
    return n if isinstance(n, str) else f"img{n}"


def pic(n, alt, ratio="4/5", pos="center"):
    return (f'<figure class="pic" style="--ratio:{ratio};--pos:{pos}"><img src="/img/{_nm(n)}.jpg" alt="{alt}" loading="lazy" decoding="async"></figure>')


def crisis_text():
    return t(
        "IMRC is not a crisis service. If you are in crisis, call or text <strong>9&#8209;8&#8209;8</strong> (Suicide Crisis Helpline), call <strong>911</strong>, or go to the nearest hospital emergency department.",
        "IMRC는 위기 대응 서비스가 아닙니다. 위기 상황이라면 <strong>9&#8209;8&#8209;8</strong>(자살 위기 상담전화)로 전화 또는 문자하시거나, <strong>911</strong>에 전화하시거나, 가까운 병원 응급실로 가세요.",
        "IMRCは危機対応サービスではありません。危機的な状況にある場合は、<strong>9&#8209;8&#8209;8</strong>（自殺危機ヘルプライン）に電話またはテキストメッセージを送るか、<strong>911</strong>に電話するか、最寄りの病院の救急外来を受診してください。",
    )


def crisis_box():
    return f'<div class="notice notice-crisis" role="note">{icon("phone")}<p>{crisis_text()}</p></div>'


def page_hero(crumbs, h1, lead="", pos="30% 40%", actions=""):
    photo_cls = photo_style = ""
    if pos.startswith("img"):
        key, _, pp = pos.partition(":")
        photo_cls = " photo"
        photo_style = f' style="--img:url(/img/{key}.jpg);--pos:{pp or "center"}"'
    cr = ""
    if crumbs:
        parts = [f'<a href="{u("/")}">{t("Home", "홈", "ホーム")}</a>']
        parts += [f'<span aria-hidden="true">/</span><span>{c}</span>' for c in crumbs]
        cr = f'<nav class="crumbs" aria-label="{t("Breadcrumb", "현재 위치", "パンくずリスト")}">{"".join(parts)}</nav>'
    lead_html = f'<p class="lead">{lead}</p>' if lead else ""
    act = f'<div class="btn-row" style="margin-top:1.8rem">{actions}</div>' if actions else ""
    return (f'<section class="page-hero nature{photo_cls}"{photo_style}><div class="wrap">{cr}<h1>{h1}</h1>{lead_html}{act}</div></section>')


# ---------------------------------------------------------------- navigation
def nav_items():
    return [
        (t("About", "소개", "私たちについて"), u("/about/"), [
            (t("Mission & Intercultural Approach", "미션과 상호문화적 접근", "ミッションと異文化アプローチ"), u("/about/#mission")),
            (t("Team & Governance", "팀과 거버넌스", "チームとガバナンス"), u("/about/#team")),
            (t("Partners & Funders", "협력 기관과 후원자", "パートナーと助成団体"), u("/about/#partners")),
        ]),
        (t("Programs & Events", "프로그램 · 행사", "プログラム・イベント"), u("/programs/"), [
            (t("All Programs", "전체 프로그램", "すべてのプログラム"), u("/programs/#all")),
            (t("Flagship: Cancer, Spirituality & Resilience", "대표 프로젝트: 암, 영성과 회복탄력성", "代表プロジェクト：がん、スピリチュアリティとレジリエンス"), u("/programs/#flagship")),
            (t("Community Mental Health 101", "지역사회 정신건강 101", "コミュニティ・メンタルヘルス入門"), u("/programs/#cmh101")),
            (t("Calendar & Registration", "일정과 신청", "カレンダーと申し込み"), u("/programs/#calendar")),
        ]),
        (t("Find Care", "케어 찾기", "ケアを探す"), u("/find-care/"), [
            (t("Approaches", "치료 접근법", "アプローチ"), u("/find-care/#approaches")),
            (t("Areas of Focus", "중점 분야", "重点分野"), u("/find-care/#focus")),
            (t("Spiritual Care", "영성 돌봄", "スピリチュアルケア"), u("/find-care/#spiritual")),
            (t("Practitioners", "치료사 목록", "セラピスト一覧"), u("/find-care/#practitioners")),
        ]),
        (t("For Professionals", "전문가를 위해", "専門職の方へ"), eu("/professionals/"), [
            (t("Clinical Supervision", "임상 슈퍼비전", "臨床スーパービジョン"), eu("/professionals/#supervision")),
            (t("Workshops & Consultation Groups", "워크숍과 자문 그룹", "ワークショップとコンサルテーショングループ"), eu("/professionals/#workshops")),
        ]),
        (t("Blog", "블로그", "ブログ"), eu("/blog/"), [
            (t("Latest posts", "최신 글", "最新の記事"), eu("/blog/")),
            (t("Write a post", "글 쓰기", "記事を書く"), eu("/blog/write/")),
        ]),
    ]


def cta_register():
    return btn(t("Register for a Program", "프로그램 신청", "プログラムに申し込む"), u("/programs/#calendar"), "reg", "btn-sm")


def cta_find():
    return btn(t("Find a Practitioner", "치료사 찾기", "セラピストを探す"), u("/find-care/#practitioners"), "find", "btn-sm")


def lang_switch(path, translated):
    out = []
    for lg in LANGS:
        if translated:
            href = u(path, lg)
        else:
            href = u("/", lg) if lg != "en" else path
        cur = ' aria-current="true"' if lg == L() else ""
        out.append(f'<a href="{href}" lang="{lg}" hreflang="{lg}"{cur}>{LANG_LABEL[lg]}</a>')
    return "".join(out)


def aud_of(href):
    """Colour code for who a link is for: s = people seeking support (green), c = clinicians (blue), p = funders and partners (yellow)."""
    if "/find-care/" in href or "/programs/" in href:
        return "s"
    if "/professionals/" in href:
        return "c"
    if "/about/#partners" in href:
        return "p"
    return ""


def header(path, translated):
    items = []
    for label, href, subs in nav_items():
        sub = "".join(f'<li><a href="{h}"{(" data-aud=" + chr(34) + aud_of(h) + chr(34)) if aud_of(h) else ""}>{s}</a></li>' for s, h in subs)
        a = aud_of(href)
        items.append(f'<li><a href="{href}"{(" data-aud=" + chr(34) + a + chr(34)) if a else ""}>{label}{icon("chevron-down")}</a><ul class="sub">{sub}</ul></li>')
    mobile = []
    for label, href, subs in nav_items():
        links = f'<a href="{href}"><strong>{t("Overview", "개요", "概要")}</strong></a>' + "".join(f'<a href="{h}">{s}</a>' for s, h in subs)
        mobile.append(f'<details><summary>{label}{icon("chevron-down")}</summary><div>{links}</div></details>')
    return f'''<a class="skip" href="#main">{t("Skip to main content", "본문으로 건너뛰기", "本文へスキップ")}</a>
<div class="crisisbar" role="note">{icon("phone")}{t("Need urgent help? Call or text", "긴급한 도움이 필요하신가요? 전화 또는 문자:", "緊急のサポートが必要な方は、電話またはテキスト：")} <a href="tel:988">9&#8209;8&#8209;8</a> · <a href="tel:911">911</a></div>
<header class="site-header"><div class="bar">
<a class="brand" href="{u("/")}" aria-label="IMRC — {t("Home", "홈", "ホーム")}"><img src="/assets/logo-mark.png" width="40" height="37" alt=""><b>IMRC</b></a>
<nav class="nav-pill" aria-label="{t("Primary", "주 메뉴", "メインメニュー")}"><ul class="nav">{"".join(items)}</ul></nav>
<div class="bar-end"><div class="lang" role="group" aria-label="{t("Language", "언어", "言語")}">{lang_switch(path, translated)}</div>
<button class="menu-btn" type="button" aria-expanded="false" aria-controls="mobile-menu" aria-label="{t("Menu", "메뉴", "メニュー")}">{icon("menu", "ic ic-m")}{icon("x", "ic ic-x")}</button></div>
</div></header>
<div class="mobile-menu" id="mobile-menu" aria-label="{t("Menu", "메뉴", "メニュー")}">
{"".join(mobile)}
</div>'''


def lang_dock(path, translated):
    return (f'<div class="lang-dock"><div class="lang" role="group" aria-label="{t("Language", "언어", "言語")}">'
            f'{lang_switch(path, translated)}</div></div>')


def footer():
    legal = t(
        "Intercultural Mental Health &amp; Resilience Research Centre is the operating name of Metta Mind Collective.",
        "상호문화 정신건강 및 회복탄력성 연구센터(Intercultural Mental Health &amp; Resilience Research Centre)는 Metta Mind Collective의 운영 명칭입니다.",
        "Intercultural Mental Health &amp; Resilience Research Centre（異文化メンタルヘルス＆レジリエンス研究センター）は、Metta Mind Collective の運営名称です。",
    )
    cols = []
    for label, href, subs in nav_items():
        links = "".join(f'<li><a href="{h}">{s}</a></li>' for s, h in subs)
        cols.append((label, href, links))
    # four columns: About+Programs, Find Care, Professionals+Blog, Contact/legal
    def col(title, *idx):
        lis = ""
        for i in idx:
            label, href, links = cols[i]
            lis += f'<li><a href="{href}"><strong>{label}</strong></a></li>' + links
        return f'<div><h2>{title}</h2><ul>{lis}</ul></div>'
    social = "".join(
        f'<a href="#" data-todo="social URL" aria-label="{n}">{icon(i)}</a>'
        for n, i in (("Instagram", "instagram"), ("Facebook", "facebook"), ("LinkedIn", "linkedin")))
    return f'''<footer class="site-footer"><div class="wrap">
<div class="foot-grid">
<div class="foot-brand"><a class="brand" href="{u("/")}"><img src="/assets/logo-mark.png" width="52" height="48" alt=""><b>IMRC</b></a>
<p>{t("Intercultural Mental Health &amp; Resilience Research Centre", "상호문화 정신건강 및 회복탄력성 연구센터", "異文化メンタルヘルス＆レジリエンス研究センター")}<br>{t("Toronto, Ontario · virtual sessions across Ontario", "온타리오주 토론토 · 온타리오 전역 화상 세션", "オンタリオ州トロント · オンタリオ全域でオンライン対応")}</p>
<div class="social" aria-label="{t("Social media", "소셜 미디어", "ソーシャルメディア")}">{social}</div></div>
{col(t("Centre", "센터", "センター"), 0, 1)}
{col(t("Care", "케어", "ケア"), 2)}
{col(t("Professionals & blog", "전문가 · 블로그", "専門職・ブログ"), 3, 4)}
</div>
<div class="foot-crisis" role="note">{icon("phone")}<p>{crisis_text()}</p></div>
<div class="foot-legal"><p>{legal}</p>
<ul>
<li><a href="{u("/contact/")}">{t("Contact", "문의하기", "お問い合わせ")}</a></li>
<li><a href="{eu("/faq/")}">{t("FAQ", "자주 묻는 질문", "よくある質問")}</a></li>
<li><a href="{eu("/privacy/")}">{t("Privacy Policy", "개인정보 처리방침", "プライバシーポリシー")}</a></li>
<li><a href="{eu("/terms/")}">{t("Terms", "이용약관", "利用規約")}</a></li>
<li><a href="{eu("/accessibility/")}">{t("Accessibility Statement", "웹 접근성 선언문", "アクセシビリティ方針")}</a></li>
<li><a href="{PRIVATE_PRACTICE_URL}" target="_blank" rel="noopener noreferrer">{t("Emma Lim — Private practice", "Emma Lim — 개인 상담실", "Emma Lim — 個人プラクティス")} ↗</a></li>
</ul></div>
</div></footer>'''


FONTS = {
    "en": "family=Geist:wght@300..700",
    "ko": "family=Geist:wght@300..700&family=Noto+Sans+KR:wght@300..700",
    "ja": "family=Geist:wght@300..700&family=Noto+Sans+JP:wght@300..700",
}


def page(path, title, desc, body, translated=True, jsonld=None, crumbs=None, lang_notice=False, scripts="", body_attrs="", og=None, noindex=False, aud=""):
    """Return a full HTML document for the current language."""
    lg = L()
    full_title = title if title.startswith("IMRC") else f"{title} · IMRC"
    canonical = BASE_URL + u(path)
    alts = ""
    if translated:
        for x in LANGS:
            alts += f'<link rel="alternate" hreflang="{x}" href="{BASE_URL + u(path, x)}">\n'
        alts += f'<link rel="alternate" hreflang="x-default" href="{BASE_URL + u(path, "en")}">\n'
    org = {
        "@context": "https://schema.org", "@type": "Organization", "name": "IMRC",
        "alternateName": "Intercultural Mental Health & Resilience Research Centre",
        "legalName": "Metta Mind Collective", "url": BASE_URL,
        "logo": BASE_URL + "/assets/logo-mark.png",
        "knowsLanguage": ["en", "ko", "ja"], "areaServed": "Ontario, Canada",
    }
    blocks = [org] + (jsonld or [])
    if crumbs:
        blocks.append({"@context": "https://schema.org", "@type": "BreadcrumbList", "itemListElement": [
            {"@type": "ListItem", "position": i + 1, "name": n, "item": BASE_URL + p} for i, (n, p) in enumerate(crumbs)]})
    def _ld(b):   # JSON inside <script>: "<", ">" and "&" must be escaped or a title containing </script> would break out of the block
        return json.dumps(b, ensure_ascii=False).replace("<", "\\u003c").replace(">", "\\u003e").replace("&", "\\u0026")
    ld = "\n".join(f'<script type="application/ld+json">{_ld(b)}</script>' for b in blocks)
    og = og or {}
    og_type = og.get("type", "website")
    og_image = og.get("image", BASE_URL + "/img/img1.jpg")
    og_published = f'<meta property="article:published_time" content="{og["published"]}">' if og.get("published") else ""
    robots = '<meta name="robots" content="noindex, nofollow">' if noindex else ""
    notice = ""
    if lang_notice:
        notice = ('<div class="lang-notice" id="lang-notice" role="status" hidden '
                  'data-ko="이 페이지는 아직 한국어로 제공되지 않아 영어로 표시됩니다." '
                  'data-ja="このページはまだ日本語に対応していないため、英語で表示しています。"></div>')
    return f'''<!doctype html>
<html lang="{lg}" class="no-js">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{escape(full_title)}</title>
<meta name="description" content="{escape(desc)}">
<link rel="canonical" href="{canonical}">
{alts}<meta property="og:type" content="{og_type}">
<meta property="og:site_name" content="IMRC">
<meta property="og:title" content="{escape(full_title)}">
<meta property="og:description" content="{escape(desc)}">
<meta property="og:image" content="{og_image}">
<meta name="twitter:card" content="summary_large_image">
{og_published}
{robots}
<link rel="alternate" type="application/rss+xml" title="IMRC Blog" href="{BASE_URL}/blog/feed.xml">
<meta property="og:image:alt" content="Rolling green hills under a soft evening sky">
<meta name="theme-color" content="#F7F4EC">
<link rel="icon" type="image/png" href="/assets/favicon.png">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?{FONTS[lg]}&display=swap">
<link rel="stylesheet" href="/css/styles.css?v={_v("css/styles.css")}">
{ld}
</head>
<body{body_attrs}>
{header(path, translated)}
<main id="main" tabindex="-1"{(" class=" + chr(34) + "aud-" + aud + chr(34)) if aud else ""}>
{notice}{body}
</main>
{footer()}
<script src="/js/data.js?v={_v("js/data.js")}"></script>
{scripts}
<script src="/js/main.js?v={_v("js/main.js")}" defer></script>
</body>
</html>
'''


def _v(rel):
    try:
        return int((SITE / rel).stat().st_mtime)
    except OSError:
        return 0


def write(rel, html):
    p = SITE / rel
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(html, encoding="utf-8")


def out_path(path, lang):
    base = "" if lang == "en" else lang + "/"
    return base + path.strip("/") + ("/" if path.strip("/") else "") + "index.html"
