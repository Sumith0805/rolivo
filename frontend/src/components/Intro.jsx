import { useCallback, useEffect, useRef, useState } from "react";
import "./Intro.css";

const TOTAL = 6200; // when the fade-out starts
const FADE = 450;

const bigT = (s) => `translate(880px,300px) scale(${s}) translate(-164px,-130px)`;
const FINAL = "translate(170px,171px) scale(1) translate(0px,0px)";
const LETTERS = [
  { id: "O", x: 542 },
  { id: "L", x: 802 },
  { id: "I", x: 1006 },
  { id: "V", x: 1090 },
  { id: "O", x: 1358 },
];

export default function Intro({ onDone }) {
  const root = useRef(null);
  const doneRef = useRef(onDone);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    doneRef.current = onDone;
  }, [onDone]);

  const leave = useCallback(() => setLeaving(true), []);

  // hand control back to the app once the fade-out has finished
  useEffect(() => {
    if (!leaving) return undefined;
    const t = setTimeout(() => doneRef.current(), FADE);
    return () => clearTimeout(t);
  }, [leaving]);

  // any of these keys skips the intro
  useEffect(() => {
    const onKey = (e) => {
      if (["Escape", "Enter", " "].includes(e.key)) setLeaving(true);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    const el = root.current;
    if (!el) return undefined;
    const $ = (s) => el.querySelector(s);
    const anims = [];
    const A = (target, keyframes, opts) => {
      const a = target.animate(keyframes, {
        fill: "both",
        easing: "cubic-bezier(.22,.61,.2,1)",
        ...opts,
      });
      anims.push(a);
      return a;
    };

    // slow camera pull-back over the whole sequence
    A($(".intro-svg"), [{ transform: "scale(1.07)" }, { transform: "scale(1)" }], {
      duration: TOTAL,
      easing: "cubic-bezier(.2,.5,.2,1)",
    });
    A($(".intro-amb"), [{ opacity: 0 }, { opacity: 1 }], {
      duration: 1800,
      delay: 600,
      easing: "ease-in-out",
    });
    el.querySelectorAll(".web").forEach((w) =>
      A(w, [{ opacity: 0 }, { opacity: 0.1 }], { duration: 1800, delay: 900, easing: "ease-out" }),
    );

    // 1) one thin thread of light opens into soft shafts
    A(
      $("#b2"),
      [
        { opacity: 0, transform: "scaleX(.06)" },
        { opacity: 1, transform: "scaleX(.09)", offset: 0.45 },
        { opacity: 0.95, transform: "scaleX(1)" },
      ],
      { duration: 1000, delay: 250, easing: "cubic-bezier(.3,.1,.2,1)" },
    );
    A(
      $("#b1"),
      [
        { opacity: 0, transform: "translateX(125px) scaleX(.1)" },
        { opacity: 0.85, transform: "translateX(0) scaleX(1)" },
      ],
      { duration: 900, delay: 700 },
    );
    A(
      $("#b3"),
      [
        { opacity: 0, transform: "translateX(-130px) scaleX(.1)" },
        { opacity: 0.85, transform: "translateX(0) scaleX(1)" },
      ],
      { duration: 900, delay: 700 },
    );
    ["#b1", "#b2", "#b3"].forEach((id) =>
      A($(id), [{ opacity: 0.9 }, { opacity: 0 }], {
        duration: 800,
        delay: 1700,
        easing: "ease-in",
        composite: "replace",
        fill: "forwards",
      }),
    );

    // crisp bright threads at the heart of each shaft
    A($("#c2"), [{ opacity: 1, transform: "scaleY(0)" }, { opacity: 1, transform: "scaleY(1)" }], {
      duration: 800,
      delay: 150,
      easing: "cubic-bezier(.3,.6,.2,1)",
    });
    ["#c1", "#c3"].forEach((id) =>
      A($(id), [{ opacity: 0, transform: "scaleY(1)" }, { opacity: 0.9, transform: "scaleY(1)" }], {
        duration: 700,
        delay: 700,
      }),
    );
    ["#c1", "#c2", "#c3"].forEach((id) =>
      A($(id), [{ opacity: 0.9 }, { opacity: 0 }], {
        duration: 700,
        delay: 1700,
        easing: "ease-in",
        composite: "replace",
        fill: "forwards",
      }),
    );

    // 2) the light folds into the three parts of the R
    const R = $("#R");
    R.style.transform = bigT(1.3);
    const piece = (id, delay) =>
      A(
        $(id),
        [
          { opacity: 0, transform: "scale(.12,1.5)", filter: "blur(12px)" },
          { opacity: 1, transform: "scale(1,1)", filter: "blur(0px)" },
        ],
        { duration: 1200, delay, easing: "cubic-bezier(.25,.7,.2,1)" },
      );
    piece("#pStem", 1200);
    piece("#pBowl", 1350);
    piece("#pLeg", 1500);

    // 3) hold on the R: slow push-in with a soft edge glow
    A(R, [{ transform: bigT(1.3) }, { transform: bigT(1.38) }], {
      duration: 1600,
      delay: 1700,
      easing: "linear",
    });
    A(
      R,
      [
        { filter: "drop-shadow(0 0 0 rgba(243,46,53,0))" },
        { filter: "drop-shadow(0 0 28px rgba(243,46,53,.7))", offset: 0.5 },
        { filter: "drop-shadow(0 0 0 rgba(243,46,53,0))" },
      ],
      { duration: 1900, delay: 1900, easing: "ease-in-out" },
    );

    // 4) the R settles and the other letters roll out from behind it
    A(R, [{ transform: bigT(1.38) }, { transform: FINAL }], {
      duration: 1300,
      delay: 3300,
      easing: "cubic-bezier(.6,0,.2,1)",
      composite: "replace",
      fill: "forwards",
    });
    el.querySelectorAll(".lt").forEach((g, i) => {
      const x = Number(g.dataset.x);
      A(
        g,
        [
          { opacity: 0, transform: `translate(${x - 190}px,171px)`, filter: "blur(8px)" },
          { opacity: 1, transform: `translate(${x}px,171px)`, filter: "blur(0px)" },
        ],
        { duration: 1300, delay: 3500 + i * 110, easing: "cubic-bezier(.2,.65,.2,1)" },
      );
    });

    // 5) depth: a soft red floor glow, one slow sweep of light, then the tagline
    A($("#floor"), [{ opacity: 0 }, { opacity: 1 }], {
      duration: 1400,
      delay: 4200,
      easing: "ease-out",
    });
    A(
      $("#sw"),
      [
        { transform: "translateX(0) skewX(-18deg)" },
        { transform: "translateX(2200px) skewX(-18deg)" },
      ],
      { duration: 1500, delay: 4600, easing: "ease-in-out" },
    );
    A($(".intro-tag"), [{ opacity: 0 }, { opacity: 1 }], { duration: 900, delay: 5000 });

    const timer = setTimeout(() => setLeaving(true), TOTAL);
    return () => {
      clearTimeout(timer);
      anims.forEach((a) => a.cancel());
    };
  }, []);

  return (
    <div className={`intro${leaving ? " leaving" : ""}`} ref={root}>
      <div className="intro-amb" />

      <svg className="intro-svg" viewBox="0 0 1760 600" role="img" aria-label="Rolivo">
        <defs>
          <linearGradient id="faceR" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="0" y2="260">
            <stop offset="0" stopColor="#f8454b" />
            <stop offset="1" stopColor="#f32e35" />
          </linearGradient>
          <linearGradient id="face" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#f8454b" />
            <stop offset="1" stopColor="#f32e35" />
          </linearGradient>
          <linearGradient id="faceDark" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#7d0f15" />
            <stop offset="1" stopColor="#4f0a0e" />
          </linearGradient>
          <linearGradient id="sheenR" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="0" y2="260">
            <stop offset="0" stopColor="#fff" stopOpacity=".24" />
            <stop offset=".4" stopColor="#fff" stopOpacity=".04" />
            <stop offset="1" stopColor="#fff" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="sheen" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#fff" stopOpacity=".24" />
            <stop offset=".4" stopColor="#fff" stopOpacity=".04" />
            <stop offset="1" stopColor="#fff" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="beam" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#d4222a" stopOpacity="0" />
            <stop offset=".5" stopColor="#ff4a51" stopOpacity="1" />
            <stop offset="1" stopColor="#d4222a" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="sweep" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#fff" stopOpacity="0" />
            <stop offset=".5" stopColor="#ffd9d2" stopOpacity=".5" />
            <stop offset="1" stopColor="#fff" stopOpacity="0" />
          </linearGradient>
          <filter id="blurBeam" x="-100%" y="-5%" width="300%" height="110%">
            <feGaussianBlur stdDeviation="12" />
          </filter>
          <filter id="blurCore" x="-400%" y="0%" width="900%" height="100%">
            <feGaussianBlur stdDeviation="1.4" />
          </filter>
          <filter id="blurFloor" x="-20%" y="-200%" width="140%" height="500%">
            <feGaussianBlur stdDeviation="16" />
          </filter>

          <path
            id="S_O"
            fillRule="evenodd"
            d="M115 0H117C181 0 232 46 232 112V146C232 212 181 258 117 258H115C51 258 0 212 0 146V112C0 46 51 0 115 0ZM116 54C86 54 58 78 58 112V146C58 180 86 204 116 204C146 204 174 180 174 146V112C174 78 146 54 116 54Z"
          />
          <path id="S_L" d="M0 0H58V202H176V258H0Z" />
          <path id="S_I" d="M0 0H58V258H0Z" />
          <path id="S_V" d="M0 0H64L120 176L176 0H240L152 258H88Z" />
          <path id="S_stem" d="M0 0H90V258H40V38Z" />
          <path
            id="S_bowl"
            d="M88 0H204C278 0 318 42 318 104C318 166 277 202 204 202H88V138H198C236 138 252 125 252 102C252 79 236 64 198 64H88Z"
          />
          <path id="S_leg" d="M115 148H204L328 260H244Z" />

          <clipPath id="clipAll">
            <use href="#S_stem" transform="translate(170 171)" />
            <use href="#S_bowl" transform="translate(170 171)" />
            <use href="#S_leg" transform="translate(170 171)" />
            <use href="#S_O" transform="translate(542 171)" />
            <use href="#S_L" transform="translate(802 171)" />
            <use href="#S_I" transform="translate(1006 171)" />
            <use href="#S_V" transform="translate(1090 171)" />
            <use href="#S_O" transform="translate(1358 171)" />
          </clipPath>
        </defs>

        {/* light shafts */}
        <rect id="b1" className="fb" x="690" y="-900" width="110" height="2400" fill="url(#beam)" filter="url(#blurBeam)" opacity="0" />
        <rect id="b2" className="fb" x="825" y="-900" width="110" height="2400" fill="url(#beam)" filter="url(#blurBeam)" opacity="0" />
        <rect id="b3" className="fb" x="955" y="-900" width="110" height="2400" fill="url(#beam)" filter="url(#blurBeam)" opacity="0" />

        <rect id="c1" className="core" x="743" y="-300" width="4" height="1200" fill="#ff8f95" filter="url(#blurCore)" opacity="0" />
        <rect id="c2" className="core" x="878" y="-300" width="4" height="1200" fill="#ff8f95" filter="url(#blurCore)" opacity="0" />
        <rect id="c3" className="core" x="1008" y="-300" width="4" height="1200" fill="#ff8f95" filter="url(#blurCore)" opacity="0" />

        {/* soft floor glow under the wordmark */}
        <ellipse id="floor" cx="880" cy="476" rx="600" ry="20" fill="rgba(243,46,53,.38)" filter="url(#blurFloor)" opacity="0" />

        {/* the other letters, rolled out from behind the R */}
        <g>
          {LETTERS.map((l, i) => (
            <g className="lt vb" data-x={l.x} key={i} opacity="0">
              <use href={`#S_${l.id}`} fill="url(#face)" />
              <use href={`#S_${l.id}`} fill="url(#sheen)" />
            </g>
          ))}
        </g>

        {/* the R: three real parts */}
        <g id="R" className="vb">
          <g id="pStem" className="fb" opacity="0">
            <use href="#S_stem" fill="url(#faceR)" />
            <use href="#S_stem" fill="url(#sheenR)" />
          </g>
          <g id="pBowl" className="fb" opacity="0">
            <use href="#S_bowl" fill="url(#faceR)" />
            <use href="#S_bowl" fill="url(#sheenR)" />
          </g>
          <g id="pLeg" className="fb" opacity="0">
            <use href="#S_leg" fill="url(#faceR)" />
            <use href="#S_leg" fill="url(#sheenR)" />
          </g>
        </g>

        <g clipPath="url(#clipAll)">
          <rect id="sw" className="vb" x="-320" y="120" width="260" height="400" fill="url(#sweep)" />
        </g>

        <text className="intro-tag" x="880" y="535" textAnchor="middle" opacity="0">
          RESUMES TAILORED TO THE JOB
        </text>
      </svg>

      <button type="button" className="intro-skip" onClick={leave}>
        Skip intro
      </button>
    </div>
  );
}
