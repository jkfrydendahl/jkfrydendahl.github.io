"use client";

import { useEffect, useRef, useState } from "react";
import content from "../src/content/love.json";

type Section = "everyday" | "courtship";
const storageKey = "everyday-love:used:v1";
const sections: { id: Section; label: string }[] = [
  { id: "everyday", label: "Everyday Love" }, { id: "courtship", label: "Courtship" },
];

export default function Home() {
  const [section, setSection] = useState<Section>("everyday");
  const [used, setUsed] = useState<string[]>([]);
  const [ready, setReady] = useState(false);
  const [storageNotice, setStorageNotice] = useState("");
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);

  useEffect(() => {
    try {
      const saved: unknown = JSON.parse(localStorage.getItem(storageKey) ?? "[]");
      if (Array.isArray(saved)) setUsed(saved.filter((id): id is string => typeof id === "string"));
    } catch { setStorageNotice("Used marks cannot be restored on this device right now."); }
    setReady(true);
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
      navigator.serviceWorker.register("/sw.js", { updateViaCache: "none" }).catch(() => {
        console.warn("Offline setup could not finish. Reopen online to try again.");
      });
    }
  }, []);

  function toggleUsed(id: string) {
    const next = used.includes(id) ? used.filter(value => value !== id) : [...used, id];
    setUsed(next);
    try { localStorage.setItem(storageKey, JSON.stringify(next)); setStorageNotice(""); }
    catch { setStorageNotice("These marks will last only until you close this page; saving is unavailable."); }
  }

  function selectTab(index: number, focus = false) {
    setSection(sections[index].id);
    if (focus) tabs.current[index]?.focus();
    window.scrollTo({ top: 0, behavior: "instant" });
  }

  return <div className="shell">
    <a className="skip" href="#reading">Skip to content</a>
    <header className="masthead">
      <div><p className="eyebrow">A pocket reference</p><h1>Everyday Love<span className="title-period">.</span></h1></div>
      <span className="book-mark" aria-hidden="true">e<span>l</span></span>
    </header>
    <nav className="navigation" aria-label="Sections">
      <div className="tabs" role="tablist" aria-label="Choose a section">
        {sections.map((item, index) => <button key={item.id} ref={element => { tabs.current[index] = element; }}
          type="button" role="tab" id={`tab-${item.id}`} aria-controls={`panel-${item.id}`}
          aria-selected={section === item.id} tabIndex={section === item.id ? 0 : -1}
          onClick={() => selectTab(index)} onKeyDown={event => {
            if (["ArrowRight", "ArrowLeft", "Home", "End"].includes(event.key)) {
              event.preventDefault();
              selectTab(event.key === "Home" ? 0 : event.key === "End" ? 1 : 1 - index, true);
            }
          }}>{item.label}</button>)}
      </div>
    </nav>
    <main id="reading" tabIndex={-1}>
      <section role="tabpanel" id="panel-everyday" aria-labelledby="tab-everyday" hidden={section !== "everyday"} tabIndex={0}>
        <div className="section-intro"><h2>Daily Roadmap</h2><span aria-hidden="true">01 — 06</span></div>
        {content.stages.map((stage, index) => <article className="stage" key={stage.title}>
          <div className="stage-heading"><span className="stage-number" aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>
            <div><h3>{stage.title}</h3><p className="descriptor">{stage.descriptor}</p></div>
          </div>
          <div className="ritual"><span className="label">Always</span><p>{stage.always}</p></div>
          <p className="optional"><span className="label">Optional</span>{stage.optional}</p>
        </article>)}
      </section>
      <section role="tabpanel" id="panel-courtship" aria-labelledby="tab-courtship" hidden={section !== "courtship"} tabIndex={0}>
        <div className="section-intro"><h2>Courtship</h2><span aria-hidden="true">{content.courtship.length} ideas</span></div>
        <p className="courtship-note">Mark an idea as used. Tap again to unmark.</p>
        {storageNotice && <p className="notice" role="status">{storageNotice}</p>}
        <ul className="courtship-list">
          {content.courtship.map((item, index) => <li key={item.id} className={used.includes(item.id) ? "used" : ""}>
            <span className="idea-number" aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>
            <p id={item.id}>{item.text}</p>
            <button type="button" className="used-button" disabled={!ready} aria-pressed={used.includes(item.id)}
              aria-label={`Used: ${item.text}`} onClick={() => toggleUsed(item.id)}>
              <span className="used-mark" aria-hidden="true">{used.includes(item.id) ? "✓" : ""}</span>
            </button>
          </li>)}
        </ul>
      </section>
    </main>
    <footer><span aria-hidden="true">✧</span> Everyday Love</footer>
  </div>;
}
