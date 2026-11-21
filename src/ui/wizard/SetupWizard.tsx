import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { arrangeLayout } from '../../layout/arrange';
import type { ArrangeResult } from '../../layout/arrange';
import { ASPECT_RATIOS, DEFAULT_MONITOR, monitorPanelSize } from '../../model/presets';
import type { AspectRatio, Layout } from '../../model/types';
import { markOnboarded } from '../../store/persistence';
import { useLayout, useStore } from '../../store/store';
import { NumberField } from '../NumberField';
import { useIsSaved } from '../useIsSaved';
import { checklistPresets, DESK_PRESETS, initialDraft, SPEAKER_PRESETS, speakerFromPreset, toSetupSpec } from './draft';
import type { WizardDraft } from './draft';
import { MiniPlan } from './MiniPlan';
import s from './SetupWizard.module.css';

const STEPS = ['Welcome', 'Desk', 'You', 'Items', 'Review'] as const;
const MAX_MONITORS = 4;
const MAX_QUANTITY = 6;

type Update = (fn: (d: WizardDraft) => WizardDraft) => void;

/** The setup wizard: desk, listener and gear, then an auto-arranged starting layout. */
export function SetupWizard() {
  const mode = useStore((st) => st.wizard);
  if (!mode) return null;
  return <Wizard firstRun={mode === 'first-run'} />;
}

function Wizard({ firstRun }: { firstRun: boolean }) {
  const layout = useLayout();
  const userPresets = useStore((st) => st.userPresets);
  const [initial] = useState(() => initialDraft(layout, userPresets, firstRun));
  const [draft, setDraft] = useState(initial);
  const [step, setStep] = useState(0);
  const update: Update = (fn) => setDraft((d) => fn(d));

  const close = () => {
    markOnboarded();
    useStore.getState().setWizard(null);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.stopPropagation();
      markOnboarded();
      useStore.getState().setWizard(null);
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, []);

  const next = () => setStep((i) => Math.min(i + 1, STEPS.length - 1));
  const back = () => setStep((i) => Math.max(i - 1, 0));
  /** Skip a step: put its answers back to how they started, and move on. */
  const skip = () => {
    setDraft((d) => {
      switch (STEPS[step]) {
        case 'Desk':
          return { ...d, desk: initial.desk };
        case 'You':
          return { ...d, listener: initial.listener };
        case 'Items':
          return { ...d, monitors: initial.monitors, speakers: initial.speakers, items: initial.items };
        default:
          return d;
      }
    });
    next();
  };

  const finish = (result: Layout) => {
    const st = useStore.getState();
    st.replaceLayout(result);
    st.setView('2d');
    st.sendViewCommand({ kind: 'fit' });
    close();
  };

  const stepName = STEPS[step] ?? 'Welcome';
  const result = useMemo(() => (stepName === 'Review' ? arrangeLayout(toSetupSpec(draft, userPresets)) : null), [stepName, draft, userPresets]);
  return (
    <div className={s.backdrop}>
      <div className={s.dialog} role="dialog" aria-modal="true" aria-labelledby="wizard-title">
        <header className={s.header}>
          <ol className={s.steps} aria-label="Steps">
            {STEPS.map((name, i) => (
              <li key={name} className={i === step ? s.stepOn : i < step ? s.stepDone : s.step} aria-current={i === step ? 'step' : undefined}>
                <span className={s.stepNo}>{i + 1}</span> {name}
              </li>
            ))}
          </ol>
          <button type="button" className={s.close} onClick={close} aria-label="Close setup" title="Close (Esc)">
            ×
          </button>
        </header>

        <div className={s.body}>
          {stepName === 'Welcome' && <Welcome firstRun={firstRun} />}
          {stepName === 'Desk' && <DeskStep draft={draft} update={update} />}
          {stepName === 'You' && <YouStep draft={draft} update={update} />}
          {stepName === 'Items' && <ItemsStep draft={draft} update={update} />}
          {stepName === 'Review' && result && <ReviewStep draft={draft} update={update} firstRun={firstRun} result={result} />}
        </div>

        {stepName !== 'Review' && (
          <footer className={s.footer}>
            {step === 0 ? (
              <button type="button" className={s.secondary} onClick={close}>
                {firstRun ? 'Skip setup' : 'Cancel'}
              </button>
            ) : (
              <button type="button" className={s.secondary} onClick={back}>
                ← Back
              </button>
            )}
            <span className={s.spacer} />
            {step > 0 && (
              <button type="button" className={s.secondary} onClick={skip} title="Use the starting values for this step">
                Skip this step
              </button>
            )}
            <button type="button" className={s.primary} onClick={next}>
              {step === 0 ? 'Start' : 'Next →'}
            </button>
          </footer>
        )}
        {stepName === 'Review' && result && (
          <footer className={s.footer}>
            <button type="button" className={s.secondary} onClick={back}>
              ← Back
            </button>
            <span className={s.spacer} />
            <button type="button" className={s.primary} onClick={() => finish(result.layout)}>
              Create layout
            </button>
          </footer>
        )}
      </div>
    </div>
  );
}

function StepTitle({ children, sub }: { children: ReactNode; sub?: ReactNode }) {
  return (
    <div className={s.titleBlock}>
      <h2 id="wizard-title">{children}</h2>
      {sub && <p className={s.lead}>{sub}</p>}
    </div>
  );
}

/** Warns before the wizard replaces a layout that hasn't been saved. */
function UnsavedWarning() {
  const layout = useLayout();
  const saved = useIsSaved();
  const [failed, setFailed] = useState(false);
  if (saved) {
    return <p className={s.ok}>“{layout.name}” is saved, so you can come back to it from Layouts.</p>;
  }
  return (
    <div className={s.warning} role="alert">
      <p>
        Finishing setup replaces <b>“{layout.name}”</b>, which has unsaved changes. Save it first if you want to keep it.
      </p>
      <button type="button" className={s.secondary} onClick={() => setFailed(!useStore.getState().saveLayout())}>
        Save “{layout.name}”
      </button>
      {failed && <p className={s.error}>Couldn’t save: browser storage is full or blocked.</p>}
    </div>
  );
}

function Welcome({ firstRun }: { firstRun: boolean }) {
  return (
    <>
      <StepTitle sub="Plan where your monitors, speakers and everything else go, at real-world scale, in 2D and 3D.">
        {firstRun ? 'Welcome to Schreibtisch' : 'Set up a new layout'}
      </StepTitle>
      <p>
        Everything is measured in millimetres. At 100% zoom, 1 mm on your desk is one pixel on screen, so a 1600 mm desk is 1600 pixels wide.
      </p>
      <p>
        A few quick steps (your desk, where you sit, and your gear) give you a sensible starting layout with the speaker triangle switched on. Every step can be
        skipped, and you can change everything afterwards.
      </p>
      {!firstRun && <UnsavedWarning />}
    </>
  );
}

function DeskStep({ draft, update }: { draft: WizardDraft; update: Update }) {
  const { desk } = draft;
  const setDesk = (patch: Partial<WizardDraft['desk']>) => update((d) => ({ ...d, desk: { ...d.desk, ...patch } }));
  const preview = useMemo(() => arrangeLayout({ ...toSetupSpec(draft, []), monitors: [], speakers: null, items: [] }).layout, [draft]);
  return (
    <>
      <StepTitle sub="Pick a common size or enter your own.">Your desk</StepTitle>
      <div className={s.chips} role="group" aria-label="Desk size presets (cm)">
        {DESK_PRESETS.map((p) => (
          <button
            key={p.label}
            type="button"
            className={desk.width === p.width && desk.depth === p.depth ? s.chipOn : s.chip}
            onClick={() => setDesk({ width: p.width, depth: p.depth })}
          >
            {p.label} cm
          </button>
        ))}
        <span className={s.chipNote}>{DESK_PRESETS.some((p) => p.width === desk.width && p.depth === desk.depth) ? '' : 'Custom'}</span>
      </div>
      <div className={s.columns}>
        <div>
          <NumberField label="Width" hint="X" value={desk.width} min={100} onCommit={(width) => setDesk({ width })} />
          <NumberField label="Depth" hint="Z" value={desk.depth} min={100} onCommit={(depth) => setDesk({ depth })} />
          <NumberField label="Thickness" value={desk.thickness} min={1} onCommit={(thickness) => setDesk({ thickness })} />
          <NumberField label="Height from floor" value={desk.heightFromFloor} min={1} title="Floor to the top of the desk" onCommit={(heightFromFloor) => setDesk({ heightFromFloor })} />
        </div>
        <MiniPlan layout={preview} height={200} />
      </div>
    </>
  );
}

function YouStep({ draft, update }: { draft: WizardDraft; update: Update }) {
  const setListener = (patch: Partial<WizardDraft['listener']>) => update((d) => ({ ...d, listener: { ...d.listener, ...patch } }));
  const preview = useMemo(() => arrangeLayout({ ...toSetupSpec(draft, []), monitors: [], speakers: null, items: [] }).layout, [draft]);
  return (
    <>
      <StepTitle sub="These two numbers drive the speaker triangle, so they're worth measuring.">Where you sit</StepTitle>
      <div className={s.columns}>
        <div>
          <NumberField
            label="Distance to your ears"
            value={draft.listener.distanceFromFrontEdge}
            onCommit={(distanceFromFrontEdge) => setListener({ distanceFromFrontEdge })}
          />
          <p className={s.hint}>Sit normally; measure from the desk's front edge to roughly between your ears.</p>
          <NumberField label="Ear height" hint="from floor" value={draft.listener.earHeightFromFloor} min={0} onCommit={(earHeightFromFloor) => setListener({ earHeightFromFloor })} />
          <p className={s.hint}>Sit normally; measure from the floor to your ear canal.</p>
          <p className={s.hint}>Not sure? 600 mm and 1200 mm are typical. You can drag yourself around the plan later.</p>
        </div>
        <MiniPlan layout={preview} height={220} />
      </div>
    </>
  );
}

function ItemsStep({ draft, update }: { draft: WizardDraft; update: Update }) {
  const userPresets = useStore((st) => st.userPresets);
  const presets = checklistPresets(userPresets);
  const groups = [...new Set(presets.map((p) => p.group))];
  return (
    <>
      <StepTitle sub="Tick what's on (or under) your desk. Sizes are typical; change them to your own if you know them.">Your gear</StepTitle>

      <section className={s.group}>
        <h3>Monitors</h3>
        <div className={s.counter}>
          <span>How many?</span>
          <Stepper
            value={draft.monitors.length}
            min={0}
            max={MAX_MONITORS}
            onChange={(n) =>
              update((d) => ({ ...d, monitors: n > d.monitors.length ? [...d.monitors, ...Array.from({ length: n - d.monitors.length }, () => ({ ...DEFAULT_MONITOR }))] : d.monitors.slice(0, n) }))
            }
            label="Number of monitors"
          />
        </div>
        {draft.monitors.map((m, i) => {
          const set = (patch: Partial<typeof m>) => update((d) => ({ ...d, monitors: d.monitors.map((x, j) => (j === i ? { ...x, ...patch } : x)) }));
          const size = monitorPanelSize(m);
          return (
            <div key={i} className={s.monitorRow}>
              <span className={s.rowName}>{i === 0 ? (draft.monitors.length > 1 ? 'Main' : 'Monitor') : `#${i + 1}`}</span>
              <NumberField className={s.compact} label="Size" unit="in" decimals={1} step={0.5} min={5} max={100} value={m.diagonalIn} onCommit={(diagonalIn) => set({ diagonalIn })} />
              <select className={s.select} aria-label="Aspect ratio" value={m.aspect} onChange={(e) => set({ aspect: e.currentTarget.value as AspectRatio })}>
                {ASPECT_RATIOS.map((a) => (
                  <option key={a}>{a}</option>
                ))}
              </select>
              <select className={s.select} aria-label="Support" value={m.support} onChange={(e) => set({ support: e.currentTarget.value === 'stand' ? 'stand' : 'mount' })}>
                <option value="mount">Arm / mount</option>
                <option value="stand">Stand</option>
              </select>
              <span className={`${s.dims} num`}>
                {Math.round(size.w)} × {Math.round(size.h)} mm
              </span>
            </div>
          );
        })}
      </section>

      <section className={s.group}>
        <h3>Speakers</h3>
        <label className={s.check}>
          <input type="checkbox" checked={draft.speakers.enabled} onChange={(e) => update((d) => ({ ...d, speakers: { ...d.speakers, enabled: e.currentTarget.checked } }))} />
          A pair of speakers (left and right)
        </label>
        {draft.speakers.enabled && <SpeakerFields draft={draft} update={update} />}
      </section>

      {groups.map((group) => (
        <section key={group} className={s.group}>
          <h3>{group}</h3>
          {presets
            .filter((p) => p.group === group)
            .map((p) => {
              const row = draft.items[p.id] ?? { checked: false, quantity: 1, size: p.size };
              const set = (patch: Partial<typeof row>) => update((d) => ({ ...d, items: { ...d.items, [p.id]: { ...row, ...patch } } }));
              return (
                <div key={p.id} className={s.itemRow}>
                  <label className={s.check}>
                    <input type="checkbox" checked={row.checked} onChange={(e) => set({ checked: e.currentTarget.checked })} />
                    {p.name}
                  </label>
                  {row.checked && (
                    <div className={s.itemFields}>
                      <Stepper value={row.quantity} min={1} max={MAX_QUANTITY} onChange={(quantity) => set({ quantity })} label={`How many: ${p.name}`} />
                      <SizeFields size={row.size} onChange={(size) => set({ size })} />
                    </div>
                  )}
                </div>
              );
            })}
        </section>
      ))}
    </>
  );
}

function SpeakerFields({ draft, update }: { draft: WizardDraft; update: Update }) {
  const sp = draft.speakers;
  const setCustom = (patch: Partial<WizardDraft['speakers']>) => update((d) => ({ ...d, speakers: { ...d.speakers, ...patch, source: 'custom' } }));
  return (
    <div className={s.speakerFields}>
      <div className={s.chips} role="group" aria-label="Speaker size">
        {SPEAKER_PRESETS.map((p) => (
          <button key={p.id} type="button" className={sp.source === p.id ? s.chipOn : s.chip} onClick={() => update((d) => ({ ...d, speakers: speakerFromPreset(p.id) }))}>
            {p.name.replace(/^Speaker, /, '')}
          </button>
        ))}
        <span className={s.chipNote}>{sp.source === 'custom' ? 'Your own sizes' : 'approx: measure yours'}</span>
      </div>
      <SizeFields size={sp.size} onChange={(size) => setCustom({ size })} />
      <NumberField
        label="Tweeter height"
        value={sp.acousticCentreHeight}
        min={0}
        title="From the bottom of the cabinet to the centre of the tweeter (the acoustic axis)"
        onCommit={(acousticCentreHeight) => setCustom({ acousticCentreHeight })}
      />
      <label className={s.check}>
        <input type="checkbox" checked={sp.rearPorted} onChange={(e) => setCustom({ rearPorted: e.currentTarget.checked })} />
        Rear-ported (a port on the back)
      </label>
    </div>
  );
}

function SizeFields({ size, onChange }: { size: { w: number; d: number; h: number }; onChange: (size: { w: number; d: number; h: number }) => void }) {
  return (
    <div className={s.sizeFields}>
      <NumberField className={s.compact} label="W" value={size.w} min={1} onCommit={(w) => onChange({ ...size, w })} title="Width" />
      <NumberField className={s.compact} label="D" value={size.d} min={1} onCommit={(d) => onChange({ ...size, d })} title="Depth" />
      <NumberField className={s.compact} label="H" value={size.h} min={1} onCommit={(h) => onChange({ ...size, h })} title="Height" />
    </div>
  );
}

function Stepper({ value, min, max, onChange, label }: { value: number; min: number; max: number; onChange: (v: number) => void; label: string }) {
  return (
    <span className={s.stepper} role="group" aria-label={label}>
      <button type="button" onClick={() => onChange(Math.max(min, value - 1))} disabled={value <= min} aria-label="Fewer">
        −
      </button>
      <span className="num" aria-live="polite">
        {value}
      </span>
      <button type="button" onClick={() => onChange(Math.min(max, value + 1))} disabled={value >= max} aria-label="More">
        +
      </button>
    </span>
  );
}

function ReviewStep({ draft, update, firstRun, result }: { draft: WizardDraft; update: Update; firstRun: boolean; result: ArrangeResult }) {
  const count = result.layout.instances.length;
  return (
    <>
      <StepTitle sub={`${count} object${count === 1 ? '' : 's'}, arranged as a starting point. Everything can be moved afterwards.`}>Your starting layout</StepTitle>
      <MiniPlan layout={result.layout} height={260} />
      {result.notes.length > 0 ? (
        <ul className={s.notes}>
          {result.notes.map((n) => (
            <li key={n}>{n}</li>
          ))}
        </ul>
      ) : (
        <p className={s.ok}>Everything fits on the desk, and the speakers form an equilateral triangle with you.</p>
      )}
      <label className={s.nameField}>
        Layout name
        <input className={s.textInput} value={draft.name} onChange={(e) => {
          const name = e.currentTarget.value;
          update((d) => ({ ...d, name }));
        }} />
      </label>
      {!firstRun && <UnsavedWarning />}
    </>
  );
}
