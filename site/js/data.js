/* IMRC content data — "enter once, show in many places".
   Add real items here; empty arrays keep the empty-state messages on the page.
   Add ?demo=1 to any page URL to preview how filled cards look (sample data, clearly labelled).

   Session shape:
   { program:"Program title", category:"healing", service:"Psychoeducation",
     start:"2026-11-14T10:00", end:"2026-11-14T12:00", tz:"America/Toronto",
     format:"online|in-person|hybrid", language:"en|ko|ja", place:"Zoom",
     status:"open|waitlist|closed", fee:"$0", url:"https://…" }
*/
window.IMRC_DATA = {
  sessions: [],
  programs: [],
  articles: []
};

window.IMRC_DEMO = {
  sessions: [
    { program: "Sample session title", category: "skills", service: "Psychoeducation", start: "2026-11-14T10:00", end: "2026-11-14T12:00", format: "online", language: "ko", place: "Zoom", status: "open", fee: "Fee note", url: "#" },
    { program: "Sample session title", category: "family", service: "Peer support", start: "2026-11-21T18:30", end: "2026-11-21T20:00", format: "in-person", language: "ja", place: "Toronto", status: "waitlist", fee: "Fee note", url: "#" }
  ],
  articles: [
    { title: "Sample article written as a question?", quick: "A 40–60 word quick answer appears here first.", author: "Author name", reviewed: "2026-10-01", url: "#" }
  ]
};
