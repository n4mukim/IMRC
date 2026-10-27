"""Pages translated into English / Korean / Japanese: Home, About, Find Care, Programs, Contact."""
from common import *


# ---------------------------------------------------------------- shared bits
def newsletter_form(pfx="nl"):
    cur = L()
    opts = "".join(
        f'<option value="{c}"{" selected" if c == cur else ""}>{n}</option>'
        for c, n in (("en", "English"), ("ko", "한국어"), ("ja", "日本語")))
    return f'''<form class="form" data-form novalidate aria-label="{t("Newsletter sign-up", "뉴스레터 구독", "ニュースレター登録")}">
<div class="field"><label for="{pfx}-email">{t("Email", "이메일", "メールアドレス")} <span class="req" aria-hidden="true">*</span></label>
<input id="{pfx}-email" name="email" type="email" autocomplete="email" required aria-describedby="{pfx}-email-err"><p class="err" id="{pfx}-email-err" role="alert"></p></div>
<div class="field"><label for="{pfx}-lang">{t("Preferred language", "선호 언어", "希望する言語")}</label><select id="{pfx}-lang" name="language">{opts}</select></div>
<div class="field"><label class="check"><input type="checkbox" name="consent" required><span>{t("Yes, I'd like to receive the IMRC monthly newsletter by email. I can unsubscribe at any time.", "네, IMRC 월간 뉴스레터를 이메일로 받겠습니다. 언제든 수신 거부할 수 있습니다.", "はい、IMRCの月刊ニュースレターをメールで受け取ります。いつでも配信停止できます。")}</span></label><p class="err" role="alert"></p></div>
<div class="hp" aria-hidden="true"><label>Leave empty<input name="website" tabindex="-1" autocomplete="off"></label></div>
<p class="small muted">{t("Sent by Metta Mind Collective.", "발신: Metta Mind Collective", "送信元：Metta Mind Collective")}</p>
<button class="btn btn-dark" type="submit"><span>{t("Subscribe", "구독하기", "登録する")}</span><span class="arr-wrap">{icon("arrow-right", "arr")}</span></button>
<p class="form-status" role="status" aria-live="polite"></p>
</form>'''


def sessions_block(limit=3, empty_id="sess-empty"):
    return f'''<div class="sessions" data-sessions data-limit="{limit}" data-empty="#{empty_id}"></div>
<div class="empty" id="{empty_id}">
<div><h3>{t("No sessions are open for registration right now.", "현재 신청 가능한 세션이 없습니다.", "現在、申し込み受付中のセッションはありません。")}</h3>
<p class="muted">{t("New sessions appear here as soon as they are confirmed. Join the monthly newsletter and we'll let you know.", "새 세션은 확정되는 대로 이곳에 게시됩니다. 월간 뉴스레터를 구독하시면 소식을 보내드립니다.", "新しいセッションは確定次第ここに掲載します。月刊ニュースレターに登録すると、お知らせをお届けします。")}</p></div>
{newsletter_form("nl-" + empty_id)}
</div>'''


# ---------------------------------------------------------------- HOME
_ICONS_GRID = {
    "couples": '<circle cx="17" cy="15" r="6"/><circle cx="32" cy="17" r="5"/><path d="M5 40c0-8 5-13 12-13s12 5 12 13M27 40c0-6 3-10 8-10s9 4 9 10"/>',
    "child": '<circle cx="24" cy="24" r="18"/><path d="M16 28c2 4 14 4 16 0"/><path d="M18 20h.01M30 20h.01"/>',
    "senior": '<path d="M6 36h36M13 36a11 11 0 0 1 22 0M24 10v6M9 17l4 4M39 17l-4 4"/>',
    "neuro": '<path d="M24 24c-4-6-8-8-12-8a8 8 0 0 0 0 16c4 0 8-2 12-8zm0 0c4 6 8 8 12 8a8 8 0 0 0 0-16c-4 0-8 2-12 8z"/>',
    "heart": '<path d="M24 40S6 29 6 17a9 9 0 0 1 18-2 9 9 0 0 1 18 2c0 12-18 23-18 23z"/>',
    "shield": '<path d="M24 6l15 5v11c0 10-7 17-15 20C16 39 9 32 9 22V11z"/><path d="M17 24l5 5 9-10"/>',
    "leaf": '<path d="M10 38C8 20 20 8 40 8c0 20-10 32-28 30z"/><path d="M10 38C18 28 26 20 34 14"/>',
}


def home():
    path = "/"
    hero = f'''<section class="hero nature photo" style="--img:url(/img/img1.jpg);--pos:50% 60%" aria-labelledby="hero-title"><div class="hero-inner">
<p class="hello"><span class="greet" lang="en" aria-hidden="true">Hello</span><span class="sr">Hello, 안녕하세요, こんにちは</span></p>
<h1 id="hero-title" class="display">{t("Care that understands <em>where you come from</em>", "당신이 <em>어디에서 왔는지</em> 이해하는 돌봄", "あなたが<em>どこから来たか</em>を理解するケア")}</h1>
<p class="lead">{t("Psychotherapy, community programs and professional training for people whose lives cross cultures. Everyone is welcome here, whatever your background, language, identity or beliefs.",
                   "문화와 문화 사이를 살아가는 분들을 위한 심리치료, 커뮤니티 프로그램, 전문가 교육. 배경, 언어, 정체성, 신념과 관계없이 누구나 환영합니다.",
                   "文化のあいだで生きる人びとのための、心理療法、コミュニティプログラム、専門職向けトレーニング。背景、言語、アイデンティティ、信念を問わず、どなたも歓迎します。")}</p>
<div class="btn-row">{btn(t("Register for a Program", "프로그램 신청", "プログラムに申し込む"), u("/programs/#calendar"), "reg")}{btn(t("Find a Practitioner", "치료사 찾기", "セラピストを探す"), u("/find-care/#practitioners"), "find")}</div>
</div></section>'''

    intro = f'''<section class="section" aria-labelledby="intro-h" style="padding-bottom:clamp(40px,6vw,80px)"><div class="wrap center">
<div class="intro reveal">{eyebrow(t("About IMRC", "IMRC 소개", "IMRCについて"))}<h2 id="intro-h" class="h2">{t("A centre for people whose lives cross cultures", "문화와 문화 사이를 살아가는 분들을 위한 센터", "文化のあいだで生きる人びとのためのセンター")}</h2>
<p class="lead">{t("We bring together culturally responsive psychotherapy, community programs, clinical supervision and professional training for therapists from diverse backgrounds.",
                   "문화적으로 민감한 심리치료, 커뮤니티 프로그램, 임상 슈퍼비전, 다양한 배경의 치료사를 위한 전문 교육을 함께 이끌어 갑니다.",
                   "文化に配慮した心理療法、コミュニティプログラム、臨床スーパービジョン、多様な背景を持つセラピストのための専門トレーニングを、ひとつにつなぎます。")}</p></div>
<div class="pcards" role="list" aria-label="{t("Choose your path", "나에게 맞는 길 찾기", "目的から選ぶ")}">
<a class="pcard reveal" style="--img:url(/img/img2.jpg)" role="listitem" href="{u("/programs/")}"><span class="dot"></span><span class="who">{t("For people seeking support", "지원이 필요한 분", "サポートを探している方")}</span><h3>{t("I'm looking for support", "지원이 필요해요", "サポートを探しています")}</h3><p>{t("Join a program, or find a practitioner who works in your language.", "프로그램에 참여하거나, 사용하시는 언어로 상담하는 치료사를 찾아보세요.", "プログラムに参加する、またはお使いの言語で対応できるセラピストを探せます。")}</p><span class="go">{icon("arrow-right")}</span></a>
<a class="pcard reveal" style="--i:1;--img:url(/img/img7.jpg)" role="listitem" href="{eu("/professionals/")}"><span class="dot"></span><span class="who">{t("For clinicians", "임상가", "臨床家の方")}</span><h3>{t("I'm a clinician", "저는 임상가예요", "私は臨床家です")}</h3><p>{t("Supervision, workshops and consultation groups for therapists.", "치료사를 위한 슈퍼비전, 워크숍, 자문 그룹.", "セラピストのためのスーパービジョン、ワークショップ、コンサルテーショングループ。")}</p><span class="go">{icon("arrow-right")}</span></a>
<a class="pcard reveal" style="--i:2;--img:url(/img/img8.jpg)" role="listitem" href="{u("/about/#partners")}"><span class="dot"></span><span class="who">{t("For funders and partners", "후원 · 협력", "助成・連携")}</span><h3>{t("I'm a funder or partner", "후원·협력 기관이에요", "助成・連携に関心があります")}</h3><p>{t("Our approach, governance, partners and funders.", "우리의 접근 방식, 거버넌스, 협력 기관과 후원자.", "私たちのアプローチ、ガバナンス、パートナーと助成団体。")}</p><span class="go">{icon("arrow-right")}</span></a>
</div></div></section>
<section class="stats reveal" aria-label="{t("At a glance", "한눈에 보기", "ひと目でわかるIMRC")}">
<div class="stat"><b>3</b><span>{t("Languages of care: English, 한국어, 日本語", "상담 언어: 영어, 한국어, 일본어", "対応言語：英語、韓国語、日本語")}</span></div>
<div class="stat"><b>30+</b><span>{t("Years of clinical experience (Emma Lim, RP, founder and director)", "임상 경력 (설립자·디렉터 Emma Lim, RP)", "臨床経験（創設者・ディレクター Emma Lim, RP）")}</span></div>
<div class="stat"><b>5</b><span>{t("Approaches: AEDP, ACT, DBT, mindfulness-based, sandplay", "접근법: AEDP, ACT, DBT, 마음챙김 기반, 모래놀이", "アプローチ：AEDP、ACT、DBT、マインドフルネス、箱庭")}</span></div>
<div class="stat"><b>Ontario</b><span>{t("Video sessions across Ontario; Toronto-based", "온타리오 전역 화상 세션, 토론토 기반", "オンタリオ全域でオンライン対応、トロント拠点")}</span></div>
</section>'''

    who = [("couples", t("Intercultural couples and families", "문화가 다른 커플과 가족", "異文化カップルと家族")),
           ("child", t("Children and youth growing up between cultures, including biracial and multiracial kids", "문화 사이에서 자라는 아동·청소년 (혼혈·다인종 포함)", "文化のはざまで育つ子ども・若者（ミックスルーツ、マルチレイシャルを含む）")),
           ("senior", t("Seniors", "노년층", "シニア")),
           ("neuro", t("Neurodivergent people and their families", "신경다양성을 가진 분과 가족", "ニューロダイバージェントの方とご家族")),
           ("heart", t("2SLGBTQ+ people", "2SLGBTQ+ 분들", "2SLGBTQ+の方")),
           ("shield", t("People and communities facing social or economic barriers", "사회·경제적 어려움을 겪는 분들과 지역사회", "社会的・経済的な困難に直面する人びとやコミュニティ")),
           ("leaf", t("Therapists looking after their own mental health", "자신의 정신건강을 돌보는 치료사", "ご自身のメンタルヘルスをケアするセラピスト"))]
    items = "".join(f'<div class="iconitem reveal" style="--i:{i % 4}"><svg viewBox="0 0 48 48" aria-hidden="true">{_ICONS_GRID[k]}</svg><p>{lbl}</p></div>' for i, (k, lbl) in enumerate(who))
    support = f'''<section class="dark nature photo section" style="--img:url(/img/img6.jpg);--pos:50% 40%" aria-labelledby="who-h"><div class="wrap center">
<div class="reveal">{eyebrow(t("Who we support", "함께하는 사람들", "支援の対象"))}<h2 id="who-h" class="h2">{t("Everyone is welcome here", "누구나 이곳에서 환영받습니다", "どなたも、ここでは歓迎されます")}</h2>
<p class="lead" style="margin-top:1rem">{t("Whatever your background, language, identity or beliefs.", "배경, 언어, 정체성, 신념과 관계없이.", "背景、言語、アイデンティティ、信念を問わず。")}</p></div>
<div class="iconsgrid">{items}</div></div></section>'''

    offer = [
        (t("Therapy", "심리치료", "心理療法"), t("Culturally responsive psychotherapy", "문화적으로 민감한 심리치료", "文化に配慮した心理療法"), t("In English, Korean and Japanese.", "영어, 한국어, 일본어로 진행합니다.", "英語・韓国語・日本語で対応します。"), "img4:50% 50%", u("/find-care/")),
        (t("Spiritual care", "영성 돌봄", "スピリチュアルケア"), t("Spiritually integrated counselling", "영성 통합 상담", "スピリチュアル統合カウンセリング"), t("Respects your values and religion.", "가치관과 종교를 존중합니다.", "あなたの価値観や宗教を尊重します。"), "img5:50% 50%", u("/find-care/#spiritual")),
        (t("Community", "커뮤니티", "コミュニティ"), t("Programs and workshops", "프로그램과 워크숍", "プログラムとワークショップ"), t("Public mental health workshops and community support.", "공개 정신건강 워크숍과 지역사회 지원.", "一般向けメンタルヘルスワークショップと地域サポート。"), "img1:50% 50%", u("/programs/")),
        (t("Professionals", "전문가", "専門職"), t("Supervision and training", "슈퍼비전과 교육", "スーパービジョンと研修"), t("For therapists from diverse backgrounds.", "다양한 배경의 치료사를 위해.", "多様な背景を持つセラピストのために。"), "img8:50% 50%", eu("/professionals/")),
    ]
    # circle colour follows who the offer is for: green = people seeking support, blue = clinicians
    ocol = ["#00A64F", "#00A64F", "#00A64F", "#0E7DC2"]
    olab = ["#007D3B", "#007D3B", "#007D3B", "#0B6AA6"]
    opos = ["8% 20%", "55% 0%", "100% 70%", "40% 100%"]
    more = t("Learn more", "자세히 보기", "詳しく見る")
    ocards = "".join(
        f'<a class="ocard reveal" style="--i:{i};--c:{ocol[i]};--lab:{olab[i]};--pos:{opos[i]}" role="listitem" href="{h}"><span class="ocard-img" aria-hidden="true"></span>'
        f'<span class="ocard-body"><span class="ocard-who">{w}</span><h3>{ti}</h3><p>{d}</p><span class="ocard-more">{more}{icon("arrow-right")}</span></span></a>'
        for i, (w, ti, d, img, h) in enumerate(offer))
    mission = f'''<section class="section" aria-labelledby="mission-h" style="padding-top:0"><div class="wrap center">
<div class="intro reveal">{eyebrow(t("Our mission", "미션", "ミッション"))}<h2 id="mission-h" class="h2">{t("To nurture culturally grounded therapists and strengthen resilience in the communities we serve.",
                                                                                                        "문화에 뿌리를 둔 치료사를 길러내고, 지역사회의 회복탄력성을 키웁니다.",
                                                                                                        "文化に根ざしたセラピストを育て、地域社会のレジリエンスを高めること。")}</h2>
<p class="lead">{t("Compassion, respect for nature and commitment to community guide everything we do.",
                   "자비, 자연에 대한 존중, 공동체에 대한 헌신이 우리의 모든 활동을 이끕니다.",
                   "思いやり、自然への敬意、コミュニティへの献身が、私たちの活動の土台です。")}</p></div>
<div class="ocards" role="list" aria-label="{t("What we offer", "제공하는 것", "提供するもの")}">{ocards}</div></div></section>'''

    quote = f'''<section class="section quote" style="--img:url(/img/img3.jpg)" aria-label="{t("A thought that guides our work", "우리가 마음에 두는 문장", "私たちが大切にしている言葉")}"><div class="wrap reveal"><figure style="margin:0"><blockquote lang="en"><p style="margin:0">“The universe is a communion of subjects, not a collection of objects.”</p></blockquote>
<figcaption>Thomas Berry{'<span class="trans" lang="ko">“우주는 대상들의 집합이 아니라 주체들의 친교입니다.” (참고용 번역)</span>' if L() == "ko" else ''}{'<span class="trans" lang="ja">「宇宙は対象の寄せ集めではなく、主体どうしの交わりである。」（参考訳）</span>' if L() == "ja" else ''}</figcaption></figure></div></section>'''

    langs = [("en", "Hello", "English", t("Practitioners who work in English", "영어로 상담하는 치료사", "英語で対応するセラピスト")),
             ("ko", "안녕하세요", "한국어", t("Practitioners who work in Korean", "한국어로 상담하는 치료사", "韓国語で対応するセラピスト")),
             ("ja", "こんにちは", "日本語", t("Practitioners who work in Japanese", "일본어로 상담하는 치료사", "日本語で対応するセラピスト"))]
    lcards = "".join(
        f'<a class="langcard reveal" style="--i:{i}" href="{u("/find-care/#practitioners")}"><span class="hi" lang="{c}">{hi}</span><span><strong lang="{c}">{nm}</strong><span class="sub-l">{d}</span></span><span class="go">{icon("arrow-right")}</span></a>'
        for i, (c, hi, nm, d) in enumerate(langs))
    approaches = "".join(f'<li class="pill">{a}</li>' for a in ("AEDP", "ACT", "DBT", t("Mindfulness-based", "마음챙김 기반", "マインドフルネス"), t("Sandplay", "모래놀이", "箱庭・サンドプレイ")))
    care = f'''<section class="section" style="padding-top:0" aria-labelledby="care-h"><div class="wrap split">
<div class="reveal">{eyebrow(t("Find Care", "케어 찾기", "ケアを探す"))}<h2 id="care-h" class="h2">{t("Find care in the language you think in", "생각하는 언어로 받는 돌봄", "考えるときの言葉で受けるケア")}</h2>
<p class="lead" style="margin-top:1rem">{t("Clinical services are provided by the practitioner named on each profile. Choose a language to see who works in it.", "임상 서비스는 각 프로필에 표기된 치료사가 직접 제공합니다. 언어를 선택해 상담 가능한 치료사를 확인하세요.", "臨床サービスは、各プロフィールに記載されたセラピストが提供します。言語を選んで、対応できるセラピストをご覧ください。")}</p>
<ul class="pills" aria-label="{t("Approaches", "치료 접근법", "アプローチ")}">{approaches}</ul>
<p style="margin-top:1.6rem">{btn(t("See approaches and practitioners", "접근법과 치료사 보기", "アプローチとセラピストを見る"), u("/find-care/"), "dark")}</p></div>
<div class="langcards">{lcards}</div></div></section>'''

    sessions = f'''<section class="section" style="padding-top:0" id="sessions" aria-labelledby="sess-h"><div class="wrap">
<div class="sec-head reveal">{eyebrow(t("Programs & Events", "프로그램 · 행사", "プログラム・イベント"))}<h2 id="sess-h" class="h2">{t("Upcoming sessions", "예정된 세션", "開催予定のセッション")}</h2></div>
<div class="reveal">{sessions_block(3, "sess-empty")}</div>
<p style="margin-top:1.4rem"><a class="link-arrow" href="{u("/programs/")}">{t("Browse all programs", "전체 프로그램 보기", "すべてのプログラムを見る")}{icon("arrow-right")}</a></p></div></section>'''

    flagship = f'''<section class="dark nature photo section" style="--img:url(/img/img4.jpg);--pos:50% 55%" aria-labelledby="flag-h"><div class="wrap split">
<div class="reveal">{eyebrow(t("Flagship project", "대표 프로젝트", "代表プロジェクト"))}<p class="status">{t("Hybrid · Korean, Japanese and English tracks", "혼합(하이브리드) · 한국어·일본어·영어 트랙", "ハイブリッド・韓国語／日本語／英語トラック")}</p>
<h2 id="flag-h" class="h2">{t("Lotus Project: Cancer, Spirituality &amp; Resilience", "연꽃(로터스) 프로젝트: 암, 영성과 회복탄력성", "ロータス・プロジェクト：がん、スピリチュアリティとレジリエンス")}</h2>
<p class="lead" style="margin-top:1.2rem">{t("A Cancer Family Meaning-Making & Resilience Circle: one in-person session in October, then monthly online sessions, with Korean, Japanese and English tracks.", "암 가족 의미 만들기와 회복탄력성 서클: 10월 대면 세션 1회, 이후 매월 온라인 세션. 한국어·일본어·영어 트랙이 있습니다.", "がん家族の意味づけとレジリエンスのサークル。10月に対面セッションを1回、その後は毎月オンラインで開催します。韓国語・日本語・英語のトラックがあります。")}</p>
<p style="margin-top:1.6rem">{btn(t("Read about the project", "프로젝트 알아보기", "プロジェクトについて"), u("/programs/#flagship"), "white")}</p></div>
<div class="pillar-list">
<div class="pillar reveal"><h3>{t("Community program", "커뮤니티 프로그램", "コミュニティプログラム")}</h3><p>{t("Group support for people affected by cancer, with room for spiritual and existential questions.", "암의 영향을 받은 분들을 위한 그룹 지원, 영적·실존적 질문을 나눌 공간.", "がんの影響を受けた方のためのグループサポート。スピリチュアルで実存的な問いを語り合える場。")}</p></div>
</div></div></section>'''

    pros = f'''<section class="section" aria-labelledby="pro-h"><div class="wrap"><div class="band-blue" style="margin:0;padding:clamp(28px,5vw,64px)"><div class="split split-even" style="align-items:center">
<div class="reveal">{eyebrow(t("For Professionals", "전문가를 위해", "専門職の方へ"))}<h2 id="pro-h" class="h2">{t("For clinicians", "임상가를 위한 공간", "臨床家の方へ")}</h2>
<p class="lead" style="margin-top:1rem">{t("Clinical supervision for RPs, RPs (Qualifying) and other mental health clinicians, plus workshops and consultation groups.", "등록심리치료사(RP), 수련 중인 RP (Qualifying), 기타 정신건강 임상가를 위한 임상 슈퍼비전과 워크숍, 자문 그룹.", "RP、RP (Qualifying)、その他のメンタルヘルス臨床家のための臨床スーパービジョン、ワークショップ、コンサルテーショングループ。")}</p></div>
<div class="reveal" style="--i:1"><div class="cards">
<div class="card"><span class="icon-badge">{icon("users")}</span><h3>{t("Clinical Supervision", "임상 슈퍼비전", "臨床スーパービジョン")}</h3><p><a class="link-arrow" href="{eu("/professionals/#supervision")}">{t("How it works", "진행 방식", "進め方")}{icon("arrow-right")}</a></p></div>
<div class="card"><span class="icon-badge">{icon("book")}</span><h3>{t("Workshops &amp; Consultation Groups", "워크숍과 자문 그룹", "ワークショップとコンサルテーション")}</h3><p><a class="link-arrow" href="{eu("/professionals/#workshops")}">{t("See what's planned", "계획 보기", "予定を見る")}{icon("arrow-right")}</a></p></div></div>
<p style="margin-top:1.4rem">{btn(t("Enquire about supervision", "슈퍼비전 문의", "スーパービジョンについて問い合わせる"), u("/contact/"), "dark")}</p></div>
</div></div></div></section>'''

    articles = f'''<section class="section" style="padding-top:0" data-blog-latest hidden aria-labelledby="art-h"><div class="wrap">
<div class="sec-head">{eyebrow(t("Blog", "블로그", "ブログ"))}<h2 id="art-h" class="h2">{t("Latest from the blog", "블로그 최신 글", "ブログの最新記事")}</h2></div>
<div class="cards"></div>
<p style="margin-top:1.4rem"><a class="link-arrow" href="{eu("/blog/")}">{t("Read the blog", "블로그 읽기", "ブログを読む")}{icon("arrow-right")}</a></p></div></section>'''

    body = hero + intro + support + mission + quote   # the home page ends after the quote
    desc = t("IMRC offers psychotherapy, community programs and professional training for people whose lives cross cultures, in English, Korean and Japanese. Toronto, Ontario.",
             "IMRC는 문화와 문화 사이를 살아가는 분들을 위한 심리치료, 커뮤니티 프로그램, 전문가 교육을 영어·한국어·일본어로 제공합니다. 온타리오주 토론토.",
             "IMRCは、文化のあいだで生きる人びとのための心理療法、コミュニティプログラム、専門職トレーニングを、英語・韓国語・日本語で提供します。オンタリオ州トロント。")
    return path, page(path, "IMRC — " + t("Intercultural Mental Health & Resilience Research Centre", "상호문화 정신건강 및 회복탄력성 연구센터", "異文化メンタルヘルス＆レジリエンス研究センター"), desc, body)


# ---------------------------------------------------------------- ABOUT
def about():
    path = "/about/"
    hero = page_hero([t("About", "소개", "私たちについて")],
                     t("A centre for people whose lives <em>cross cultures</em>", "문화와 문화 사이를 살아가는 분들을 위한 <em>센터</em>", "文化の<em>あいだ</em>で生きる人びとのためのセンター"),
                     t("The Intercultural Mental Health & Resilience Research Centre (IMRC) brings together psychotherapy, community programs, clinical supervision and professional training.",
                       "상호문화 정신건강 및 회복탄력성 연구센터(IMRC)는 심리치료, 커뮤니티 프로그램, 임상 슈퍼비전, 전문 교육을 함께 이끌어 갑니다.",
                       "異文化メンタルヘルス＆レジリエンス研究センター（IMRC）は、心理療法、コミュニティプログラム、臨床スーパービジョン、専門職トレーニングを結びつけています。"),
                     "img5:50% 60%")
    mission = f'''<section class="section" id="mission" aria-labelledby="mission-h"><div class="wrap split">
<div class="reveal">{eyebrow(t("Mission & Intercultural Approach", "미션과 상호문화적 접근", "ミッションと異文化アプローチ"))}{pic(6, t("Green hillside with scattered trees and wildflowers", "나무와 들꽃이 어우러진 푸른 언덕", "木々と野の花が点在する緑の丘"), "4/5", "50% 40%")}</div>
<div class="reveal stack" style="--i:1"><h2 id="mission-h" class="h2">{t("To nurture the next generation of values-oriented, culturally grounded therapists", "가치 지향적이고 문화에 뿌리를 둔 차세대 치료사를 길러냅니다", "価値観を大切にし、文化に根ざした次世代のセラピストを育てます")}</h2>
<p class="lead">{t("And to strengthen resilience in the communities we serve.", "그리고 우리가 함께하는 지역사회의 회복탄력성을 키웁니다.", "そして、私たちが関わる地域社会のレジリエンスを高めます。")}</p>
<p>{t("We support intercultural couples and families, children and youth, and seniors. We pay special attention to biracial and multiracial children and teens growing up between cultures, and to the mental health of therapists themselves. We also offer spiritually integrated counselling that respects each person's values and religion.",
     "저희는 문화가 다른 커플과 가족, 아동·청소년, 노년층과 함께합니다. 문화 사이에서 자라는 혼혈·다인종 아동과 청소년, 그리고 치료사 자신의 정신건강에 특별히 주의를 기울입니다. 또한 한 사람 한 사람의 가치관과 종교를 존중하는 영성 통합 상담도 제공합니다.",
     "異文化カップルと家族、子どもや若者、シニアを支援しています。文化のはざまで育つミックスルーツやマルチレイシャルの子どもや十代、そしてセラピスト自身のメンタルヘルスにも特に目を向けています。また、一人ひとりの価値観や宗教を尊重するスピリチュアル統合カウンセリングも行っています。")}</p>
<p>{t("We bring a spirit of compassion, respect for nature and animals, and a commitment to community into everything we do. Through public mental health workshops, ongoing community programs, and community support, we work to build a more peaceful world across cultures.",
     "자비와 연민, 자연과 동물에 대한 존중, 공동체에 대한 헌신을 모든 활동에 담습니다. 공개 정신건강 워크숍, 지속적인 커뮤니티 프로그램, 지역사회 지원을 통해 문화를 넘어 더 평화로운 세상을 만들어 가고자 합니다.",
     "思いやり、自然と動物への敬意、コミュニティへの献身を、あらゆる活動に込めています。一般向けメンタルヘルスワークショップ、継続的なコミュニティプログラム、地域サポートを通じて、文化を越えたより平和な世界を目指します。")}</p></div>
</div></section>'''

    certs = [
        (t("Certified Clinical Supervisor", "공인 임상 슈퍼바이저", "認定臨床スーパーバイザー"), "RP (Registered Psychotherapist)"),
        (t("Master of Arts (MA)", "문학석사 (MA)", "文学修士（MA）"), ""),
        (t("Master of Psychospiritual Studies", "심리영성학 석사", "サイコスピリチュアル研究修士"), "University of Toronto"),
        ("AEDP (Accelerated Experiential Dynamic Psychotherapy)", "Certification Candidate"),
        (t("Sandplay Therapy", "모래놀이 치료", "箱庭療法（サンドプレイセラピー）"), "Certification Candidate"),
        ("EMDR", "Certification Candidate"),
        ("DBT (Dialectical Behaviour Therapy)", "Level 1 & 2"),
        ("ACT (Acceptance and Commitment Therapy)", "Educator"),
        ("PCIT (Parent–Child Interaction Therapy)", ""),
        (t("Baby Massage", "베이비 마사지", "ベビーマッサージ"), "Educator"),
        (t("Canadian Sandplay Therapy Association", "캐나다 모래놀이치료협회", "カナダ・サンドプレイセラピー協会"), t("Board member", "이사", "理事")),
    ]
    cert_html = "".join(f'<li><span>{a}</span><span>{b}</span></li>' for a, b in certs)
    founder = f'''<section class="section" style="padding-top:0" id="founder" aria-labelledby="founder-h"><div class="wrap split">
<div class="reveal">{eyebrow(t("Founder & Director", "설립자 · 디렉터", "創設者・ディレクター"))}{pic("emma", "Portrait of Emma Lim, Registered Psychotherapist", "4/5", "50% 22%")}</div>
<div class="reveal stack" style="--i:1"><h2 id="founder-h" class="h2">Emma Lim, RP</h2>
<p class="muted">{t("Registered Psychotherapist", "공인 심리치료사 (Registered Psychotherapist)", "公認心理療法士（Registered Psychotherapist）")} · CRPO #008377 · RP, MPS</p>
<p>{t("Emma is a Registered Psychotherapist and certified clinical supervisor with over 30 years of clinical experience. She has worked with individuals, couples, families and groups across the lifespan, and provides therapy in English, Korean and Japanese. Her work focuses on trauma and PTSD, depression, anxiety, grief and loss, relationship distress, life transitions, and spiritual and existential concerns. She also has a special interest in supporting neurodivergent individuals.",
     "Emma는 공인 심리치료사(Registered Psychotherapist)이자 공인 임상 슈퍼바이저로, 30년 이상의 임상 경력을 가지고 있습니다. 전 생애에 걸쳐 개인, 부부, 가족, 집단과 작업해 왔으며 영어, 한국어, 일본어로 상담합니다. 트라우마와 PTSD, 우울, 불안, 상실과 애도, 관계의 어려움, 삶의 전환기, 영적·실존적 고민을 주로 다루며, 신경다양성을 가진 분들을 지원하는 데에도 각별한 관심이 있습니다.",
     "Emma は公認心理療法士（Registered Psychotherapist）であり認定臨床スーパーバイザーで、30年以上の臨床経験があります。生涯のあらゆる段階にある個人、カップル、家族、グループと関わり、英語・韓国語・日本語でセラピーを行っています。トラウマとPTSD、うつ、不安、喪失と悲嘆、人間関係の悩み、人生の転機、スピリチュアルで実存的な悩みを中心に、ニューロダイバージェントの方への支援にも特に関心を持っています。")}</p>
<p>{t("Having lived for many years in Korea, Japan, the United Kingdom and Canada, she brings an intercultural perspective to her work, and a commitment to a culturally attuned and anti-oppressive framework. Her approach is experiential, relational and mindful. She draws mainly on AEDP, ACT and DBT, and integrates sandplay therapy, EMDR, somatic and mindfulness-based approaches according to each person's needs.",
     "한국, 일본, 영국, 캐나다에서 오래 살아온 경험을 바탕으로 상호문화적 관점을 가지고 있으며, 문화적으로 민감하고 반억압적인 틀을 지향합니다. 접근 방식은 체험적이고 관계적이며 마음챙김에 기반합니다. 주로 AEDP, ACT, DBT를 활용하고, 필요에 따라 모래놀이 치료, EMDR, 신체 기반 및 마음챙김 기반 접근을 통합합니다.",
     "韓国、日本、イギリス、カナダで長年暮らした経験から、異文化の視点と、文化に配慮した反抑圧的な枠組みを大切にしています。アプローチは体験的・関係的でマインドフルです。主にAEDP、ACT、DBTを用い、必要に応じて箱庭療法、EMDR、身体的アプローチ、マインドフルネスを統合します。")}</p>
<h3 style="font-size:1.1rem;font-weight:600;margin-top:1.6rem">{t("Training and credentials", "교육과 자격", "研修と資格")}</h3>
<ul class="cert">{cert_html}</ul>
<p class="small muted">{t("Training levels are stated exactly. A certification candidate is not a certified practitioner.", "수련 단계는 있는 그대로 표기합니다. 인증 후보(Certification Candidate)는 인증을 받은 것이 아닙니다.", "研修の段階は正確に記載しています。Certification Candidate（認定候補）は認定取得を意味しません。")}</p>
<p>{t("Outside of work, Emma loves nature and animals, and believes that humans are part of nature and are meant to live in harmony with it.", "일 밖에서 Emma는 자연과 동물을 사랑하며, 인간은 자연의 일부로서 자연과 조화롭게 살아가야 한다고 믿습니다.", "仕事以外では自然と動物を愛し、人間は自然の一部であり、自然と調和して生きるものだと考えています。")}</p>
<p><a class="link-arrow" href="{u("/find-care/#emma-lim")}">{t("See Emma's practitioner profile", "Emma의 치료사 프로필 보기", "Emma のセラピストプロフィールを見る")}{icon("arrow-right")}</a></p></div>
</div></section>'''

    team = f'''<section class="section" id="team" style="padding-top:0" aria-labelledby="team-h"><div class="wrap">
<div class="sec-head reveal">{eyebrow(t("Team & Governance", "팀과 거버넌스", "チームとガバナンス"))}<h2 id="team-h" class="h2">{t("Who is behind the Centre", "센터를 이끄는 사람들", "センターを支える人びと")}</h2></div>
<div class="grid-2 reveal">
<div class="card"><h3>{t("Legal form", "법적 형태", "法人形態")}</h3><p>{t("IMRC is the operating name of Metta Mind Collective.", "IMRC는 Metta Mind Collective의 운영 명칭입니다.", "IMRCは Metta Mind Collective の運営名称です。")}</p><p class="small muted">{t("Year founded:", "설립 연도:", "設立年：")} 2026</p></div>
<div class="card"><h3>{t("Leadership", "리더십", "リーダーシップ")}</h3><p>{t("Founder & Director: Emma Lim, RP. A Multicultural Community Advisory Committee is in formation.", "설립자·디렉터: Emma Lim, RP. 다문화 지역사회 자문위원회를 구성하고 있습니다.", "創設者・ディレクター：Emma Lim, RP。多文化コミュニティ諮問委員会を組成中です。")}</p><p class="small muted">{t("Team members are listed with their exact registered titles.", "팀원은 등록된 정확한 직함으로 소개합니다.", "チームメンバーは登録されている正確な肩書で紹介します。")}</p></div>
</div></div></section>'''

    partners = f'''<section class="section" id="partners" style="padding-top:0" aria-labelledby="partners-h"><div class="wrap">
<div class="sec-head reveal">{eyebrow(t("Partners & Funders", "협력 기관과 후원자", "パートナーと助成団体"))}<h2 id="partners-h" class="h2">{t("Working alongside others", "함께 일하는 분들", "ともに歩む仲間")}</h2></div>
<div class="empty reveal"><div><h3>{t("Partners and funders are named here once they agree in writing.", "협력 기관과 후원자는 서면 동의를 받은 후 이곳에 소개합니다.", "パートナーと助成団体は、書面での同意を得たのちに、こちらに掲載します。")}</h3><p class="muted">{t("Interested in working with the Centre?", "센터와 함께하고 싶으신가요?", "センターとの連携にご関心がありますか？")}</p></div>
<div>{btn(t("Send a partnership enquiry", "협력 문의 보내기", "連携について問い合わせる"), u("/contact/"), "dark")}</div></div></div></section>'''
    body = hero + mission + founder + team + partners
    return path, page(path, t("About", "소개", "私たちについて"),
                      t("About IMRC: our mission, intercultural approach, founder and director, team and governance.", "IMRC 소개: 미션, 상호문화적 접근, 설립자·디렉터, 팀과 거버넌스.", "IMRCについて：ミッション、異文化アプローチ、創設者・ディレクター、チームとガバナンス。"),
                      body, crumbs=[("Home", u("/")), ("About", u(path))])


# ---------------------------------------------------------------- FIND CARE
def find_care():
    path = "/find-care/"
    hero = page_hero([t("Find Care", "케어 찾기", "ケアを探す")],
                     t("Find care that <em>speaks your language</em>", "당신의 언어로 <em>이야기하는</em> 돌봄을 찾아보세요", "あなたの言葉で<em>話せる</em>ケアを探す"),
                     t("Every profile names who provides the service. Clinical services are provided by the practitioner named on each page.", "모든 프로필에는 서비스를 제공하는 사람이 명시되어 있습니다. 임상 서비스는 각 페이지에 표기된 치료사가 직접 제공합니다.", "すべてのプロフィールに、サービスを提供する人が明記されています。臨床サービスは、各ページに記載されたセラピストが提供します。"),
                     "img3:50% 50%",
                     btn(t("See practitioners", "치료사 보기", "セラピストを見る"), "#practitioners", "dark"))
    appr = [
        ("AEDP", t("Accelerated Experiential Dynamic Psychotherapy. An experiential approach that pays close attention to emotion and body sensation, moment by moment, within the therapy relationship.", "Accelerated Experiential Dynamic Psychotherapy. 치료 관계 안에서 감정과 신체 감각을 순간순간 세심하게 살피는 체험적 접근입니다.", "Accelerated Experiential Dynamic Psychotherapy。セラピーの関係の中で、感情や身体感覚に一瞬一瞬注意を向ける体験的アプローチです。")),
        ("ACT", t("Acceptance and Commitment Therapy. Builds psychological flexibility by clarifying what matters to you and practising mindful, committed action.", "Acceptance and Commitment Therapy. 소중한 가치를 분명히 하고 마음챙김 속에서 실천하며 심리적 유연성을 키웁니다.", "Acceptance and Commitment Therapy。大切にしたい価値を明確にし、マインドフルに行動を重ねることで、心理的な柔軟性を育てます。")),
        ("DBT", t("Dialectical Behaviour Therapy. A skills-based approach that teaches mindfulness, emotion regulation, distress tolerance and interpersonal effectiveness.", "Dialectical Behaviour Therapy. 마음챙김, 정서 조절, 고통 감내, 대인관계 효율성을 배우는 기술 중심 접근입니다.", "Dialectical Behaviour Therapy。マインドフルネス、感情調整、苦痛耐性、対人関係スキルを学ぶスキル中心のアプローチです。")),
        (t("Mindfulness-based", "마음챙김 기반", "マインドフルネス・ベース"), t("Uses present-moment awareness practices to change how we relate to thoughts, emotions and sensations.", "지금 이 순간의 알아차림 연습으로 생각, 감정, 감각과 관계 맺는 방식을 바꿔 갑니다.", "今この瞬間への気づきの練習を通して、思考・感情・感覚との関わり方を変えていきます。")),
        (t("Sandplay", "모래놀이", "箱庭・サンドプレイ"), t("Uses a tray of sand and small figures to express inner experience, without needing words.", "모래 상자와 작은 소품으로 말 없이도 내면의 경험을 표현합니다.", "砂の入った箱と小さなミニチュアを使い、言葉にしなくても内面の体験を表現します。")),
    ]
    appr_html = "".join(f'<div class="card reveal" style="--i:{i}"><h3>{n}</h3><p>{d}</p></div>' for i, (n, d) in enumerate(appr))
    approaches = f'''<section class="section" id="approaches" aria-labelledby="appr-h"><div class="wrap">
<div class="sec-head reveal">{eyebrow(t("Approaches", "치료 접근법", "アプローチ"))}<h2 id="appr-h" class="h2">{t("How practitioners work", "치료사가 일하는 방식", "セラピストの関わり方")}</h2>
<p class="lead">{t("Approaches are listed only after a practitioner attests to their training and an administrator reviews it. Training levels are shown on each profile.", "접근법은 치료사가 자신의 수련 내용을 확인하고 운영진이 검토한 뒤에만 게시합니다. 수련 단계는 각 프로필에 표기됩니다.", "アプローチは、セラピストが研修内容を申告し、運営側が確認した後にのみ掲載します。研修の段階は各プロフィールに記載します。")}</p></div>
<div class="cards">{appr_html}</div></div></section>'''

    focus = [t("Trauma and PTSD", "트라우마와 PTSD", "トラウマとPTSD"), t("Depression", "우울", "うつ"), t("Anxiety", "불안", "不安"), t("Grief and loss", "상실과 애도", "喪失と悲嘆"),
             t("Relationship distress", "관계의 어려움", "人間関係の悩み"), t("Life transitions", "삶의 전환기", "人生の転機"), t("Spiritual and existential concerns", "영적·실존적 고민", "スピリチュアルで実存的な悩み"),
             t("Intercultural relationships", "문화가 다른 관계", "異文化間の人間関係"), t("Supporting neurodivergent people", "신경다양성을 가진 분 지원", "ニューロダイバージェントの方への支援")]
    focus_html = "".join(f'<li>{f}</li>' for f in focus)
    focus_sec = f'''<section class="section" id="focus" style="padding-top:0" aria-labelledby="focus-h"><div class="wrap split">
<div class="reveal">{eyebrow(t("Areas of Focus", "중점 분야", "重点分野"))}<h2 id="focus-h" class="h2">{t("What practitioners focus on", "치료사가 중점을 두는 분야", "セラピストが重点を置く分野")}</h2></div>
<div class="reveal" style="--i:1"><ul class="checks">{focus_html}</ul><p class="small muted" style="margin-top:1rem">{t("Areas of focus appear on a profile only after the practitioner attests to verifiable training.", "중점 분야는 치료사가 검증 가능한 수련을 확인한 후에만 프로필에 표시됩니다.", "重点分野は、セラピストが検証可能な研修を申告した後にのみ、プロフィールに表示されます。")}</p></div>
</div></section>'''

    spiritual = f'''<section class="section dark nature photo" style="--img:url(/img/img2.jpg);--pos:50% 50%" id="spiritual" aria-labelledby="spir-h"><div class="wrap split">
<div class="reveal">{eyebrow(t("Spiritual Care", "영성 돌봄", "スピリチュアルケア"))}<h2 id="spir-h" class="h2">{t("Spiritually integrated psychotherapy", "영성 통합 심리치료", "スピリチュアル統合心理療法")}</h2></div>
<div class="reveal stack" style="--i:1"><p class="lead">{t("Spiritual care is integrated within Registered Psychotherapy sessions, and only when you want it. Non-clinical spiritual care is also available as a separate session on request.",
                                                                                    "영성 돌봄은 등록 심리치료 상담 안에 통합되어 있으며, 원하시는 경우에만 함께합니다. 요청하시면 비임상(치료가 아닌) 영성 돌봄을 별도 세션으로도 받으실 수 있습니다.",
                                                                                    "スピリチュアルケアは登録心理療法のセッションの中に統合されており、ご希望の場合にのみ行います。ご希望があれば、非臨床のスピリチュアルケアを別枠のセッションとして受けることもできます。")}</p>
<p>{t("Your values, religion and spiritual life are welcome in the room. They are yours to bring, or to leave out.", "당신의 가치관과 종교, 영적인 삶은 상담실에서 환영받습니다. 꺼내 놓을지 말지는 당신의 선택입니다.", "あなたの価値観、宗教、スピリチュアルな生き方は、セッションの場で歓迎されます。持ち込むかどうかは、あなたが決めてください。")}</p></div>
</div></section>'''

    cred = [("AEDP", "Certification Candidate"), (t("Sandplay Therapy", "모래놀이 치료", "箱庭療法"), "Certification Candidate"), ("EMDR", "Certification Candidate"), ("DBT", "Level 1 & 2"), ("ACT", "Educator")]
    cred_html = "".join(f'<li><span>{a}</span><span>{b}</span></li>' for a, b in cred)
    practitioners = f'''<section class="section" id="practitioners" aria-labelledby="prac-h"><div class="wrap">
<div class="sec-head reveal">{eyebrow(t("Practitioners", "치료사 목록", "セラピスト一覧"))}<h2 id="prac-h" class="h2">{t("Practitioners", "치료사 목록", "セラピスト一覧")}</h2>
<p class="lead">{t("Clinical services are provided by the practitioner named on each profile. Booking opens on Jane App, a secure scheduling service. Jane App booking pages are in English.", "임상 서비스는 각 프로필에 표기된 치료사가 직접 제공합니다. 예약은 보안이 갖춰진 예약 서비스인 Jane App에서 진행되며, Jane App 예약 페이지는 영어로 제공됩니다.", "臨床サービスは、各プロフィールに記載されたセラピストが提供します。予約は、安全な予約サービスJane Appで行います。Jane Appの予約ページは英語です。")}</p></div>
<article class="practitioner reveal" id="emma-lim" aria-labelledby="emma-name">
{pic("emma", "Portrait of Emma Lim, Registered Psychotherapist", "4/5", "50% 22%")}
<div><span class="tag">{t("Registered Psychotherapist · Founder & Clinical Director", "공인 심리치료사 · 설립자 · 임상 디렉터", "公認心理療法士・創設者・臨床ディレクター")}</span>
<h3 id="emma-name">Emma Lim, RP, MPS</h3>
<dl class="defs">
<dt>{t("Registration", "등록 정보", "登録情報")}</dt><dd>{t("CRPO #008377 · listed on the register as Eun Lim (Emma Lim)", "CRPO #008377 · 등록 명부 표기: Eun Lim (Emma Lim)", "CRPO #008377・登録簿での名義：Eun Lim（Emma Lim）")}</dd>
<dt>{t("Languages", "상담 언어", "対応言語")}</dt><dd><span lang="en">English</span> · <span lang="ko">한국어</span> · <span lang="ja">日本語</span></dd>
<dt>{t("Areas of focus", "중점 분야", "重点分野")}</dt><dd>{t("Trauma and PTSD, depression, anxiety, grief and loss, relationship distress, life transitions, spiritual and existential concerns", "트라우마와 PTSD, 우울, 불안, 상실과 애도, 관계의 어려움, 삶의 전환기, 영적·실존적 고민", "トラウマとPTSD、うつ、不安、喪失と悲嘆、人間関係の悩み、人生の転機、スピリチュアルで実存的な悩み")}</dd>
<dt>{t("Approaches", "접근법", "アプローチ")}</dt><dd><ul class="cert" style="margin:0">{cred_html}</ul></dd>
<dt>{t("Where", "진행 지역", "対応地域")}</dt><dd>{t("Clients must be physically located in Ontario during sessions. Virtual sessions across Ontario; Toronto office in person by appointment on designated days.", "상담 중 내담자는 온타리오주 내에 실제로 계셔야 합니다. 온타리오 전역 화상 세션, 토론토 사무실 대면 상담은 지정된 요일에 예약제로 진행합니다.", "セッション中、クライアントはオンタリオ州内に所在している必要があります。オンタリオ全域でオンライン対応、トロントのオフィスでの対面は指定日に予約制で行います。")}</dd>
<dt>{t("Fees", "상담 비용", "料金")}</dt><dd>{t("Individual: $225 CAD / 50 min. Couples and family: $325 CAD / 75 min. A limited number of sliding-scale spots are available.", "개인: 50분 225 CAD. 부부·가족: 75분 325 CAD. 소득 연동 요금(슬라이딩 스케일)은 소수 자리만 가능합니다.", "個人：50分 225カナダドル。カップル・家族：75分 325カナダドル。スライディングスケール（所得に応じた料金）は枠に限りがあります。")}</dd>
<dt>{t("First step", "첫 단계", "最初のステップ")}</dt><dd>{t("Complimentary 15-minute phone or video consultation.", "무료 15분 전화 또는 화상 상담.", "無料の15分間の電話またはビデオ相談。")}</dd>
<dt>{t("New clients", "신규 내담자", "新規のご相談")}</dt><dd>{t("Currently accepting new clients (virtual and in person).", "현재 신규 내담자를 받고 있습니다 (화상 및 대면).", "現在、新規のクライアントを受け付けています（オンライン・対面）。")}</dd></dl>
<div class="statement-box"><p style="margin:0 0 .4rem"><strong>{t("Clinical services are provided by Emma Lim, RP.", "임상 서비스는 Emma Lim, RP가 직접 제공합니다.", "臨床サービスは Emma Lim, RP が提供します。")}</strong></p>
<p style="margin:0">{t("Independent practitioner. A listing does not mean IMRC provides or oversees this practitioner's clinical services.", "독립 치료사입니다. 목록에 올라 있다는 것이 IMRC가 이 치료사의 임상 서비스를 제공하거나 감독한다는 뜻은 아닙니다.", "独立したセラピストです。掲載されていることは、IMRCがこのセラピストの臨床サービスを提供または監督していることを意味しません。")}</p></div>
<div class="btn-row">{btn(t("Book on Jane App (English)", "Jane App에서 예약 (영어)", "Jane Appで予約（英語）"), JANE_URL, "blue", ext=True)}{btn(t("Emma Lim — Private practice", "Emma Lim — 개인 상담실", "Emma Lim — 個人プラクティス"), PRIVATE_PRACTICE_URL, "line", ext=True)}</div></div></article>
<p class="small muted reveal" style="margin-top:1.2rem">{t("More practitioners will be listed here as they join. A filtered directory opens once five or six practitioners are listed.", "치료사가 합류하는 대로 이곳에 추가됩니다. 5~6명이 등록되면 필터 기능이 있는 디렉터리가 열립니다.", "セラピストが加わり次第、こちらに掲載します。5〜6名が登録された時点で、絞り込み機能のあるディレクトリを公開します。")}</p></div></section>'''

    faqs = [
        (t("What does a session cost?", "상담 비용은 얼마인가요?", "料金はいくらですか？"), t("Individual sessions are $225 CAD for 50 minutes. Couples and family sessions are $325 CAD for 75 minutes. A limited number of sliding-scale spots are available. A complimentary 15-minute phone or video consultation is offered first.", "개인 상담은 50분 225 CAD, 부부·가족 상담은 75분 325 CAD입니다. 소득 연동 요금(슬라이딩 스케일)은 소수 자리만 가능합니다. 먼저 무료 15분 전화 또는 화상 상담을 받으실 수 있습니다.", "個人セッションは50分で225カナダドル、カップル・家族セッションは75分で325カナダドルです。スライディングスケール（所得に応じた料金）は枠に限りがあります。最初に、無料の15分間の電話またはビデオ相談を受けられます。")),
        (t("Is psychotherapy covered by OHIP or insurance?", "심리치료는 OHIP이나 보험으로 보장되나요?", "心理療法はOHIPや保険の対象ですか？"), t("Psychotherapy with a Registered Psychotherapist is not covered by OHIP. Many extended health benefit plans do cover Registered Psychotherapists, so check your own plan. There is no direct billing: official receipts are issued through Jane App for reimbursement.", "등록 심리치료사(RP)의 심리치료는 OHIP으로 보장되지 않습니다. 많은 직장 확장 건강보험이 RP를 보장하므로 본인의 플랜을 확인해 보세요. 보험사 직접 청구는 하지 않으며, 환급 청구를 위한 공식 영수증은 Jane App을 통해 발급됩니다.", "公認心理療法士（RP）による心理療法はOHIPの対象外です。多くの拡張医療保険がRPを対象としているため、ご自身のプランをご確認ください。保険会社への直接請求は行っておらず、払い戻し用の正式な領収書をJane Appで発行します。") + f' {todo("[Confirm: no direct billing]")}'),
        (t("Online or in person?", "온라인인가요, 대면인가요?", "オンラインですか、対面ですか？"), t("Secure video sessions are available across Ontario. In-person sessions take place at the Toronto office, by appointment on designated days.", "온타리오 전역에서 보안이 갖춰진 화상 세션이 가능합니다. 대면 상담은 토론토 사무실에서 지정된 요일에 예약제로 진행합니다.", "オンタリオ全域で安全なビデオセッションが可能です。対面セッションは、トロントのオフィスで指定日に予約制で行います。") + f' {todo("[Confirm office location: Toronto or Markham]")}'),
        (t("What if I live outside Ontario?", "온타리오 밖에 살고 있다면요?", "オンタリオ州外に住んでいる場合は？"), t("Clients must be physically located in Ontario during sessions, under CRPO regulations.", "CRPO 규정에 따라, 상담 중 내담자는 온타리오주 내에 실제로 계셔야 합니다.", "CRPOの規則により、セッション中、クライアントはオンタリオ州内に所在している必要があります。")),
        (t("What is the cancellation policy?", "취소 규정은 어떻게 되나요?", "キャンセルポリシーは？"), t("24 hours' notice is required. Late cancellations and no-shows are billed the full session fee.", "24시간 전까지 알려 주셔야 합니다. 늦은 취소와 무단 불참은 상담료 전액이 청구됩니다.", "24時間前までのご連絡が必要です。直前のキャンセルや無断欠席は、セッション料金の全額を請求します。")),
        (t("Who regulates Registered Psychotherapists?", "등록 심리치료사는 어느 기관이 관리하나요?", "公認心理療法士を規制する機関は？"), t("The College of Registered Psychotherapists of Ontario (CRPO) sets the rules for Registered Psychotherapists and handles complaints.", "온타리오 공인 심리치료사 협회(CRPO)가 등록 심리치료사에 대한 규정을 정하고 불만 사항을 처리합니다.", "オンタリオ公認心理療法士協会（CRPO）が、公認心理療法士に関する規則を定め、苦情を受け付けています。")),
    ]
    acc = "".join(f'<details><summary>{q}</summary><div class="ans">{a}</div></details>' for q, a in faqs)
    before = f'''<section class="section" id="before-you-book" style="padding-top:0" aria-labelledby="bef-h"><div class="wrap split">
<div class="reveal">{eyebrow(t("Before you book", "예약 전에", "予約の前に"))}<h2 id="bef-h" class="h2">{t("What to know before you book", "예약 전에 알아두세요", "予約の前に知っておきたいこと")}</h2>
<p style="margin-top:1rem">{t("A complimentary 15-minute phone or video consultation is offered as a first step.", "첫 단계로 무료 15분 전화 또는 화상 상담을 제공합니다.", "最初のステップとして、無料の15分間の電話またはビデオ相談を行っています。")}</p></div>
<div class="acc reveal" style="--i:1">{acc}</div></div></section>
<section class="section-tight" style="padding-top:0"><div class="wrap-narrow">{crisis_box()}</div></section>'''

    person = {"@context": "https://schema.org", "@type": "Person", "name": "Emma Lim", "jobTitle": "Registered Psychotherapist",
              "knowsLanguage": ["en", "ko", "ja"], "worksFor": {"@type": "Organization", "name": "IMRC"}, "areaServed": "Ontario, Canada"}
    body = hero + approaches + focus_sec + spiritual + practitioners + before
    return path, page(path, t("Find Care", "케어 찾기", "ケアを探す"),
                      t("Find care in English, Korean or Japanese. Approaches, areas of focus, spiritual care and practitioners at IMRC.", "영어, 한국어, 일본어로 받는 돌봄. IMRC의 치료 접근법, 중점 분야, 영성 돌봄, 치료사 목록.", "英語・韓国語・日本語で受けられるケア。IMRCのアプローチ、重点分野、スピリチュアルケア、セラピスト一覧。"),
                      body, jsonld=[person], crumbs=[("Home", u("/")), ("Find Care", u(path))])


# ---------------------------------------------------------------- PROGRAMS
def programs():
    path = "/programs/"
    hero = page_hero([t("Programs & Events", "프로그램 · 행사", "プログラム・イベント")],
                     t("Programs and events, <em>together</em>", "프로그램과 행사, <em>함께</em>", "プログラムとイベントを、<em>ともに</em>"),
                     t("Group programs, workshops and community events. Every program lists its service type, so it is always clear whether it is psychotherapy.", "그룹 프로그램, 워크숍, 커뮤니티 행사. 모든 프로그램에는 서비스 유형이 표기되어 심리치료인지 아닌지 분명히 알 수 있습니다.", "グループプログラム、ワークショップ、コミュニティイベント。すべてのプログラムにサービスの種類を明記しているため、心理療法かどうかが一目でわかります。"),
                     "img1:50% 70%", btn(t("See upcoming sessions", "예정된 세션 보기", "開催予定を見る"), "#calendar", "dark"))
    cats = [
        (t("Cancer, Spirituality & Resilience", "암, 영성과 회복탄력성", "がん、スピリチュアリティとレジリエンス"), t("Community support and reflection for people affected by cancer, with room for spiritual and existential questions.", "암의 영향을 받은 분들을 위한 커뮤니티 지원과 성찰, 영적·실존적 질문을 위한 공간.", "がんの影響を受けた方のためのコミュニティサポートと対話。スピリチュアルで実存的な問いのための場も。"), "leaf"),
        (t("Interfaith & Wisdom Circles", "종교와 지혜의 서클", "異なる信仰と智慧のサークル"), t("Reading and reflection circles that welcome many faiths and none.", "다양한 신앙을 가진 분, 신앙이 없는 분 모두를 환영하는 독서·성찰 모임.", "さまざまな信仰を持つ方も、持たない方も歓迎する読書と対話のサークル。"), "book"),
        (t("Healing & Recovery", "치유와 회복", "癒しと回復"), t("Groups for people working through trauma, loss and difficult relationships.", "트라우마, 상실, 어려운 관계를 지나고 있는 분들을 위한 모임.", "トラウマ、喪失、困難な人間関係と向き合う人のためのグループ。"), "message"),
        (t("Skills & Psychoeducation", "기술과 심리교육", "スキルと心理教育"), t("Practical skills and learning drawn from approaches such as ACT and DBT.", "ACT, DBT 등의 접근에서 가져온 실용적인 기술과 배움.", "ACTやDBTなどのアプローチから生まれた、実践的なスキルと学び。"), "compass"),
        (t("Family & Life Stages", "가족과 삶의 단계", "家族とライフステージ"), t("Support for intercultural and biracial families, and for seniors.", "문화가 다른 가족, 혼혈 가족, 노년층을 위한 지원.", "異文化家族やミックスルーツの家族、シニアへのサポート。"), "users"),
    ]
    garden = [
        ("Sunflower Project", t("Autism Spectrum Family Support (Parents & Siblings)", "자폐 스펙트럼 가족 지원 (부모와 형제자매)", "自閉スペクトラム症のご家族への支援（親・きょうだい）"), "users", ("해바라기 프로젝트", "ひまわりプロジェクト")),
        ("Evergreen Project", t("Suicide Prevention", "자살 예방", "自殺予防"), "message", ("에버그린 프로젝트", "エバーグリーン・プロジェクト")),
        ("Lotus Project", t("Cancer Family Meaning-Making & Resilience Circle", "암 가족 의미 만들기와 회복탄력성 서클", "がん家族の意味づけとレジリエンスのサークル"), "leaf", ("연꽃(로터스) 프로젝트", "ロータス・プロジェクト")),
        ("Ginkgo Project", t("Eco-Spirituality Community", "에코 영성 커뮤니티", "エコ・スピリチュアリティ・コミュニティ"), "compass", ("은행나무 프로젝트", "イチョウ・プロジェクト")),
        ("Wildflower Project", t("200% Multiracial Families", "200% 다인종 가족", "200%マルチレイシャル・ファミリー"), "users", ("들꽃 프로젝트", "野の花プロジェクト")),
        ("Seed Project", t("Psychoeducational & Spiritual Care", "심리교육과 영성 돌봄", "心理教育とスピリチュアルケア"), "book", ("씨앗 프로젝트", "種のプロジェクト")),
    ]

    def _gname(n, tr):
        return n if L() == "en" else f'{tr[0] if L() == "ko" else tr[1]} <span class="muted small" lang="en">({n})</span>'
    cat_html = "".join(
        f'<div class="card reveal" style="--i:{i % 3}"><span class="icon-badge">{icon(ic)}</span><h3>{_gname(n, tr)}</h3><p>{d}</p>'
        f'<div class="proj-dates" data-project="{n}"></div><p class="small proj-tba"><span class="tag">{t("Dates to be announced", "일정 추후 공지", "日程は後日発表")}</span></p></div>'
        for i, (n, d, ic, tr) in enumerate(garden))
    allp = f'''<section class="section" id="all" aria-labelledby="all-h"><div class="wrap">
<div class="sec-head reveal">{eyebrow(t("All Programs", "전체 프로그램", "すべてのプログラム"))}<h2 id="all-h" class="h2">{t("The IMRC Garden", "IMRC 가든", "IMRCガーデン")}</h2>
<p class="lead">{t("Six projects, each named for something that grows. Sessions appear in the calendar as they open.", "자라나는 것들의 이름을 딴 여섯 개의 프로젝트입니다. 세션은 열리는 대로 캘린더에 표시됩니다.", "育つものの名前をつけた6つのプロジェクト。セッションは開催が決まり次第、カレンダーに表示されます。")}</p></div>
<div class="cards">{cat_html}</div></div></section>'''

    flagship = f'''<section class="section dark nature photo" style="--img:url(/img/img4.jpg);--pos:50% 55%" id="flagship" aria-labelledby="fl-h"><div class="wrap split">
<div class="reveal">{eyebrow(t("Flagship", "대표 프로젝트", "代表プロジェクト"))}<p class="status">{t("Hybrid · Korean, Japanese and English tracks", "혼합(하이브리드) · 한국어·일본어·영어 트랙", "ハイブリッド・韓国語／日本語／英語トラック")}</p><h2 id="fl-h" class="h2">{t("Lotus Project: Cancer, Spirituality &amp; Resilience", "연꽃(로터스) 프로젝트: 암, 영성과 회복탄력성", "ロータス・プロジェクト：がん、スピリチュアリティとレジリエンス")}</h2></div>
<div class="reveal stack" style="--i:1"><p class="lead">{t("Our flagship project offers community support around cancer care and survivorship, with attention to spirituality and meaning.", "저희의 대표 프로젝트는 암 돌봄과 암 생존 과정을 중심으로, 영성과 삶의 의미에 주목하며 커뮤니티 지원을 제공합니다.", "代表プロジェクトは、がんケアとサバイバーシップをテーマに、スピリチュアリティと意味づけに目を向けながら、コミュニティサポートを提供します。")}</p>
<div class="pillar"><h3>{t("Program", "프로그램", "プログラム")}</h3><p>{t("Cancer Family Meaning-Making & Resilience Circle. One in-person session in October, plus monthly online sessions, with Korean, Japanese and English tracks.", "암 가족 의미 만들기와 회복탄력성 서클. 10월 대면 세션 1회와 매월 온라인 세션으로 진행하며, 한국어·일본어·영어 트랙이 있습니다.", "がん家族の意味づけとレジリエンスのサークル。10月に対面セッションを1回、その後は毎月オンラインで開催し、韓国語・日本語・英語のトラックがあります。")}</p></div>
</div></div></section>'''

    cmh = f'''<section class="section" id="cmh101" aria-labelledby="cmh-h"><div class="wrap split">
<div class="reveal">{eyebrow(t("Community Mental Health 101", "지역사회 정신건강 101", "コミュニティ・メンタルヘルス入門"))}<h2 id="cmh-h" class="h2">{t("Mental health basics, for communities and workplaces", "지역사회와 직장을 위한 정신건강 기초", "地域や職場のためのメンタルヘルスの基礎")}</h2></div>
<div class="reveal stack" style="--i:1"><p class="lead">{t("A 90-minute webinar or workshop, in English, Korean or Japanese, on cultural stigma, navigating intercultural mental health, and somatic grounding.", "문화적 낙인, 상호문화적 정신건강 헤쳐 나가기, 신체 기반 안정화(소매틱 그라운딩)를 다루는 90분 웨비나 또는 워크숍. 영어, 한국어, 일본어로 진행합니다.", "文化的スティグマ、異文化でのメンタルヘルスとの向き合い方、ソマティック・グラウンディングを扱う、90分のウェビナーまたはワークショップ。英語・韓国語・日本語で実施します。")}</p>
<p>{btn(t("Request a workshop for your organization", "우리 기관을 위한 워크숍 요청", "団体向けワークショップを依頼する"), u("/contact/"), "dark")}</p></div></div></section>'''

    filters = "".join(f'<button type="button" aria-pressed="false" data-f="{k}">{lbl}</button>' for k, lbl in (("online", t("Online", "온라인", "オンライン")), ("in-person", t("In person", "대면", "対面")), ("en", "English"), ("ko", "한국어"), ("ja", "日本語")))
    calendar = f'''<section class="section" id="calendar" style="padding-top:0" aria-labelledby="cal-h"><div class="wrap">
<div class="sec-head reveal">{eyebrow(t("Calendar & Registration", "일정과 신청", "カレンダーと申し込み"))}<h2 id="cal-h" class="h2">{t("Upcoming sessions", "예정된 세션", "開催予定のセッション")}</h2></div>
<div class="filters" role="group" aria-label="{t("Filter sessions", "세션 필터", "セッションの絞り込み")}" id="sess-filters" hidden>{filters}</div>
<div class="reveal">{sessions_block(50, "cal-empty")}</div>
<div class="grid-2" style="margin-top:2rem">
<div class="card card-sage"><h3>{t("How registration works", "신청 방법", "申し込みの流れ")}</h3><p>{t("Registration for therapy and support groups goes through Jane App only. Professional workshops use Stripe checkout. This site stores no booking data and no personal health information.", "치료 및 지원 그룹 신청은 Jane App을 통해서만 진행됩니다. 전문가 워크숍은 Stripe 결제를 사용합니다. 이 사이트에는 예약 정보나 개인 건강 정보가 저장되지 않습니다.", "セラピーやサポートグループの申し込みは、Jane Appのみで受け付けます。専門職向けワークショップはStripeで決済します。このサイトには、予約情報や個人の健康情報は保存されません。")}</p></div>
{crisis_box()}</div></div></section>'''
    body = hero + calendar + allp + flagship + cmh
    return path, page(path, t("Programs & Events", "프로그램 · 행사", "プログラム・イベント"),
                      t("Group programs, workshops and community events at IMRC, with the service type listed for each.", "IMRC의 그룹 프로그램, 워크숍, 커뮤니티 행사. 각 프로그램의 서비스 유형을 함께 안내합니다.", "IMRCのグループプログラム、ワークショップ、コミュニティイベント。各プログラムのサービスの種類を明記しています。"),
                      body, crumbs=[("Home", u("/")), ("Programs & Events", u(path))])


# ---------------------------------------------------------------- CONTACT
def contact():
    path = "/contact/"
    hero = page_hero([t("Contact", "문의하기", "お問い合わせ")],
                     t("Say hello. We read <em>every message</em>", "인사를 건네 주세요. 모든 메시지를 <em>읽습니다</em>", "ご連絡ください。<em>すべてのメッセージ</em>に目を通します"),
                     t("For questions about programs, supervision, workshops or partnerships. To book therapy, see our practitioners.", "프로그램, 슈퍼비전, 워크숍, 협력에 관한 문의를 보내 주세요. 심리치료 예약은 치료사 목록에서 진행됩니다.", "プログラム、スーパービジョン、ワークショップ、連携に関するご質問はこちらから。セラピーの予約は、セラピスト一覧からお進みください。"),
                     "img7:50% 60%")
    langopts = "".join(f'<option value="{c}"{" selected" if c == L() else ""}>{n}</option>' for c, n in (("en", "English"), ("ko", "한국어"), ("ja", "日本語")))
    form = f'''<section class="section"><div class="wrap split">
<div class="reveal stack">{eyebrow(t("Send a message", "메시지 보내기", "メッセージを送る"))}<h2 class="h2">{t("How can we help?", "무엇을 도와드릴까요?", "どのようなご用件でしょうか？")}</h2>
<div class="notice">{icon("info")}<p>{t("Please do not include personal medical or therapy details in this form. Clinical intake is handled through encrypted Jane App software.", "이 양식에 개인의 의료 정보나 상담 관련 내용을 적지 마세요. 임상 접수는 암호화된 Jane App 소프트웨어를 통해 진행됩니다.", "このフォームに、個人の医療情報やセラピーに関する詳細は記入しないでください。臨床の受付は、暗号化されたJane Appを通じて行います。")}</p></div>
{crisis_box()}
<ul class="stack" style="margin-top:1rem">
<li style="display:flex;gap:.8rem">{icon("pin")}<span>{t("Toronto, Ontario · virtual sessions across Ontario", "온타리오주 토론토 · 온타리오 전역 화상 세션", "オンタリオ州トロント · オンタリオ全域でオンライン対応")}</span></li>
<li style="display:flex;gap:.8rem">{icon("mail")}<span><a href="mailto:contact@culturalresilience.org">contact@culturalresilience.org</a></span></li></ul></div>
<form class="form card reveal" style="--i:1" data-form novalidate aria-label="{t("Contact form", "문의 양식", "お問い合わせフォーム")}">
<div class="field"><label for="c-name">{t("Name", "이름", "お名前")} <span class="req" aria-hidden="true">*</span></label><input id="c-name" name="name" autocomplete="name" required aria-describedby="c-name-err"><p class="err" id="c-name-err" role="alert"></p></div>
<div class="field"><label for="c-email">{t("Email", "이메일", "メールアドレス")} <span class="req" aria-hidden="true">*</span></label><input id="c-email" name="email" type="email" autocomplete="email" required aria-describedby="c-email-err"><p class="err" id="c-email-err" role="alert"></p></div>
<div class="field"><label for="c-lang">{t("Preferred language", "선호 언어", "希望する言語")}</label><select id="c-lang" name="language">{langopts}</select></div>
<div class="field"><label for="c-msg">{t("Message", "메시지", "メッセージ")} <span class="req" aria-hidden="true">*</span></label><textarea id="c-msg" name="message" required aria-describedby="c-msg-hint c-msg-err"></textarea><p class="hint" id="c-msg-hint">{t("Keep it short. No health details, please.", "짧게 적어 주세요. 건강 관련 내용은 적지 말아 주세요.", "簡潔にお書きください。健康に関する内容は記入しないでください。")}</p><p class="err" id="c-msg-err" role="alert"></p></div>
<div class="hp" aria-hidden="true"><label>Leave empty<input name="website" tabindex="-1" autocomplete="off"></label></div>
<button class="btn btn-dark" type="submit"><span>{t("Send message", "메시지 보내기", "送信する")}</span><span class="arr-wrap">{icon("arrow-right", "arr")}</span></button>
<p class="form-status" role="status" aria-live="polite"></p>
</form></div></section>
<section class="section" style="padding-top:0"><div class="wrap"><div class="card card-sage" style="display:flex;flex-wrap:wrap;gap:1.2rem;justify-content:space-between;align-items:center"><div><h2 class="h3">{t("Looking to book therapy?", "심리치료를 예약하고 싶으신가요?", "セラピーの予約をご希望ですか？")}</h2><p style="margin:.4rem 0 0">{t("Choose a practitioner and book on Jane App.", "치료사를 선택하고 Jane App에서 예약하세요.", "セラピストを選んで、Jane Appで予約してください。")}</p></div>{btn(t("Find a Practitioner", "치료사 찾기", "セラピストを探す"), u("/find-care/#practitioners"), "find")}</div></div></section>'''
    return path, page(path, t("Contact", "문의하기", "お問い合わせ"),
                      t("Contact IMRC with questions about programs, supervision, workshops or partnerships.", "프로그램, 슈퍼비전, 워크숍, 협력에 관해 IMRC에 문의하세요.", "プログラム、スーパービジョン、ワークショップ、連携についてのIMRCへのお問い合わせ。"),
                      hero + form, crumbs=[("Home", u("/")), ("Contact", u(path))])


MAIN_PAGES = [home, about, find_care, programs, contact]
