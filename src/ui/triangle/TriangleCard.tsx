import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { analyzeTriangle, classifyAngle, classifyDistance } from '../../layout/triangle';
import type { SpeakerReading, ToleranceClass, TriangleReading } from '../../layout/triangle';
import { applyTriangleFix } from '../../layout/triangleFixes';
import type { TriangleFix } from '../../layout/triangleFixes';
import { setSettings } from '../../model/ops';
import type { Layout, Tolerances } from '../../model/types';
import { applyFix, toggleTriangle } from '../../store/commands';
import { useLayout, useStore } from '../../store/store';
import { NumberField } from '../NumberField';
import s from './TriangleCard.module.css';

const IDEAL_ANGLE = 60;

function mm(v: number): string {
  const r = Math.round(v);
  return `${Object.is(r, -0) ? 0 : r} mm`;
}

function signedMm(v: number): string {
  const r = Math.round(v);
  return r > 0 ? `+${r} mm` : r < 0 ? `−${-r} mm` : '0 mm';
}

function deg(v: number): string {
  return `${v.toFixed(1)}°`;
}

/** A turn as degrees plus a rotation arrow: ↺ = counter-clockwise seen from above (like Q), ↻ = clockwise (E). */
function turn(v: number): string {
  const a = Math.abs(v);
  if (a < 0.05) return '0.0°';
  return `${a.toFixed(1)}° ${v > 0 ? '↺' : '↻'}`;
}

function Val({ cls, children, title }: { cls?: ToleranceClass | undefined; children: ReactNode; title?: string }) {
  return (
    <span className={`num ${cls ? s[cls] : ''}`} title={title}>
      {children}
    </span>
  );
}

const NA = <span className={s.na}>n/a</span>;

/** The floating speaker-triangle readout: numbers, one-click fixes and tolerance settings. */
export function TriangleCard() {
  const layout = useLayout();
  const view = useStore((st) => st.view);
  const show = layout.settings.showTriangle;
  const [collapsed, setCollapsed] = useState(false);
  const t = useMemo(() => (show ? analyzeTriangle(layout) : null), [layout, show]);
  if (!show) return null;

  return (
    <section className={`${s.card} ${view === '3d' ? s.below3dToolbar : ''}`} aria-label="Speaker triangle">
      <header className={s.header}>
        <button type="button" className={s.title} onClick={() => setCollapsed(!collapsed)} aria-expanded={!collapsed}>
          <span className={s.chevron}>{collapsed ? '▸' : '▾'}</span> Speaker triangle
        </button>
        <button type="button" className={s.close} onClick={toggleTriangle} title="Hide the triangle (T)" aria-label="Hide the speaker triangle">
          ×
        </button>
      </header>
      {!collapsed && (t ? <Readout layout={layout} t={t} /> : <NoPair />)}
    </section>
  );
}

function NoPair() {
  const setTab = useStore((st) => st.setSidebarTab);
  return (
    <div className={s.body}>
      <p className={s.empty}>
        The triangle needs a left and a right speaker.{' '}
        <button type="button" className={s.link} onClick={() => setTab('library')}>
          Add a speaker pair
        </button>{' '}
        from the Library, or select any object and set its <b>Speaker role</b> in the Inspector.
      </p>
    </div>
  );
}

function Readout({ layout, t }: { layout: Layout; t: TriangleReading }) {
  const tol = layout.settings.tolerances;
  const angleCls = (a: number) => classifyAngle(a - IDEAL_ANGLE, tol);
  const { symmetry: sym } = t;
  return (
    <div className={s.body}>
      <div className={s.table} role="table" aria-label="Triangle readings">
        <div className={s.thead} role="row">
          <span />
          <span role="columnheader">Left</span>
          <span role="columnheader">Right</span>
          <span role="columnheader">You</span>
        </div>
        <Row label="Distance to you" title="From each tweeter to the centre of your head, in plan">
          <Val>{mm(t.sides.leftListener)}</Val>
          <Val>{mm(t.sides.rightListener)}</Val>
          <span />
        </Row>
        <Row label="Angle" title="Interior angles of the triangle; 60° each is ideal">
          {t.angles ? (
            <>
              <Val cls={angleCls(t.angles.left)}>{deg(t.angles.left)}</Val>
              <Val cls={angleCls(t.angles.right)}>{deg(t.angles.right)}</Val>
              <Val cls={angleCls(t.angles.listener)}>{deg(t.angles.listener)}</Val>
            </>
          ) : (
            <>
              {NA}
              {NA}
              {NA}
            </>
          )}
        </Row>
        <Row label="Toe-in" title="How far each speaker should turn to point at you. ↺ = counter-clockwise seen from above (Q), ↻ = clockwise (E)">
          <ToeIn s={t.left} tol={tol} />
          <ToeIn s={t.right} tol={tol} />
          <span />
        </Row>
        <Row label="Ears vs tweeter" title="Ear height minus tweeter height (+ = your ears are higher). Green when the tweeter points at your ears, tilt included">
          <Vertical s={t.left} tol={tol} />
          <Vertical s={t.right} tol={tol} />
          <span />
        </Row>
        {layout.backWall && (
          <Row label="Gap to wall" title="From the back of each cabinet to the wall. Rear-ported speakers usually want some room">
            <Wall s={t.left} />
            <Wall s={t.right} />
            <span />
          </Row>
        )}
      </div>

      <dl className={s.facts}>
        <div>
          <dt>Speaker spacing</dt>
          <dd className="num">{mm(t.sides.lr)}</dd>
        </div>
        <div>
          <dt title="Left distance minus right distance">Distance difference</dt>
          <dd>
            <Val cls={classifyDistance(sym.distanceDiff, tol)}>{signedMm(sym.distanceDiff)}</Val>
          </dd>
        </div>
        <div>
          <dt title="How far you sit from the point midway between the speakers, along the line between them (+ = toward the right speaker)">Off-centre</dt>
          <dd>{sym.offsetAlong === null ? NA : <Val cls={classifyDistance(sym.offsetAlong, tol)}>{signedMm(sym.offsetAlong)}</Val>}</dd>
        </div>
      </dl>

      <Fixes layout={layout} t={t} />
      <Settings layout={layout} />
      <p className={s.hint}>
        Your listening distance matters most. Sit normally and measure from the desk&apos;s front edge to roughly between your ears.{' '}
        <button type="button" className={s.link} onClick={() => useStore.getState().select({ kind: 'listener' })}>
          Edit listener
        </button>
      </p>
    </div>
  );
}

function Row({ label, title, children }: { label: string; title: string; children: ReactNode }) {
  return (
    <div className={s.row} role="row" title={title}>
      <span className={s.rowLabel} role="rowheader">
        {label}
      </span>
      {children}
    </div>
  );
}

function ToeIn({ s: sp, tol }: { s: SpeakerReading; tol: Tolerances }) {
  if (sp.toeInError === null) return NA;
  return (
    <Val cls={classifyAngle(sp.toeInError, tol)} title={sp.requiredYaw === null ? undefined : `Yaw ${deg(sp.requiredYaw)} would point it at you`}>
      {turn(sp.toeInError)}
    </Val>
  );
}

function Vertical({ s: sp, tol }: { s: SpeakerReading; tol: Tolerances }) {
  const { dy, angle, tiltError } = sp.vertical;
  // Coloured by whether the tweeter points at your ears (tilt included), not by the height gap itself.
  return (
    <Val
      cls={tiltError === null ? undefined : classifyAngle(tiltError, tol)}
      title={angle === null || tiltError === null ? undefined : `Your ears are ${deg(angle)} up from the tweeter; tilting by ${deg(angle)} would point it at them (${deg(tiltError)} to go)`}
    >
      {signedMm(dy)}
    </Val>
  );
}

function Wall({ s: sp }: { s: SpeakerReading }) {
  if (sp.wallDistance === null) return NA;
  return (
    <Val cls={sp.rearPorted ? 'amber' : undefined} title={sp.rearPorted ? 'Rear-ported: check the maker’s recommended gap' : undefined}>
      {mm(sp.wallDistance)}
    </Val>
  );
}

const FIXES: { fix: TriangleFix; label: string; title: string }[] = [
  { fix: 'listener', label: 'Move listener to ideal', title: 'Put your head at the tip of an equilateral triangle on the current speakers' },
  { fix: 'speakers', label: 'Move speakers to ideal', title: 'Keep your position; move both speakers into an equilateral triangle, aimed at you' },
  { fix: 'aim', label: 'Aim speakers at you', title: 'Turn both speakers to point at you' },
  { fix: 'tilt', label: 'Tilt to ear height', title: 'Tilt both speakers so the tweeters point at your ears' },
];

function Fixes({ layout, t }: { layout: Layout; t: TriangleReading }) {
  const mode = useStore((st) => st.speakerFitMode);
  const setMode = useStore((st) => st.setSpeakerFitMode);
  const setPreview = useStore((st) => st.setFixPreview);
  const locked = [t.left, t.right].filter((sp) => sp.locked).map((sp) => sp.label);
  const changes = useMemo(
    () => Object.fromEntries(FIXES.map(({ fix }) => [fix, applyTriangleFix(layout, fix, mode) !== layout])) as Record<TriangleFix, boolean>,
    [layout, mode],
  );
  return (
    <div className={s.fixes}>
      {FIXES.map(({ fix, label, title }) => (
        <div key={fix} className={s.fixRow}>
          <button
            type="button"
            className={s.fix}
            title={title}
            disabled={!changes[fix]}
            onClick={() => applyFix(fix)}
            onPointerEnter={() => setPreview(fix)}
            onPointerLeave={() => setPreview(null)}
            onFocus={() => setPreview(fix)}
            onBlur={() => setPreview(null)}
          >
            {label}
          </button>
          {fix === 'speakers' && (
            <div className={s.modes} role="group" aria-label="Triangle size">
              <button type="button" className={mode === 'distance' ? s.modeOn : s.mode} onClick={() => setMode('distance')} title="Keep each speaker about as far from you as now">
                keep distance
              </button>
              <button type="button" className={mode === 'spacing' ? s.modeOn : s.mode} onClick={() => setMode('spacing')} title="Keep the speakers the same distance apart">
                keep spacing
              </button>
            </div>
          )}
        </div>
      ))}
      {locked.length > 0 && <p className={s.note}>{locked.join(' and ')} {locked.length > 1 ? 'are' : 'is'} locked, so the fixes leave {locked.length > 1 ? 'them' : 'it'} alone.</p>}
    </div>
  );
}

function Settings({ layout }: { layout: Layout }) {
  const apply = useStore((st) => st.apply);
  const { tolerances: tol, aimOffset } = layout.settings;
  const setTol = (patch: Partial<Tolerances>) => apply((l) => setSettings(l, { tolerances: { ...l.settings.tolerances, ...patch } }));
  return (
    <details className={s.settings}>
      <summary>Tolerances and aim</summary>
      <p className={s.legend}>
        <span className={s.green}>green</span> within the first value, <span className={s.amber}>amber</span> within the second, <span className={s.red}>red</span> beyond.
      </p>
      <NumberField label="Angle: good" unit="°" value={tol.angleGood} min={0} onCommit={(angleGood) => setTol({ angleGood })} />
      <NumberField label="Angle: OK" unit="°" value={tol.angleWarn} min={0} onCommit={(angleWarn) => setTol({ angleWarn })} />
      <NumberField label="Distance: good" value={tol.distGood} min={0} onCommit={(distGood) => setTol({ distGood })} />
      <NumberField label="Distance: OK" value={tol.distWarn} min={0} onCommit={(distWarn) => setTol({ distWarn })} />
      <NumberField
        label="Aim offset"
        value={aimOffset}
        title="Aim the speakers this far behind the centre of your head (some people prefer slightly behind). 0 = the centre of your head"
        onCommit={(v) => apply((l) => setSettings(l, { aimOffset: v }))}
      />
    </details>
  );
}
