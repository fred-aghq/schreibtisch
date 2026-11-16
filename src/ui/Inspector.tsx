import { useLayout, useStore } from '../store/store';
import { InstanceInspector } from './InstanceInspector';
import { LayoutInspector } from './LayoutInspector';
import { ListenerInspector } from './ListenerInspector';

/** Right sidebar: edits the selected object, the listener, or (with nothing selected) the layout. */
export function Inspector() {
  const layout = useLayout();
  const selection = useStore((s) => s.selection);

  if (selection?.kind === 'instance') {
    const inst = layout.instances.find((i) => i.id === selection.id);
    const def = inst ? layout.definitions[inst.definitionId] : undefined;
    if (inst && def) return <InstanceInspector layout={layout} inst={inst} def={def} />;
  }
  if (selection?.kind === 'listener') return <ListenerInspector layout={layout} />;
  return <LayoutInspector layout={layout} />;
}
