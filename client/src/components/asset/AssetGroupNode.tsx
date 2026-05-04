import { memo } from 'react';
import { ChevronDown, ChevronRight, Focus, Plus, Settings } from 'lucide-react';
import { Handle, Position, type Node, type NodeProps } from '@xyflow/react';
import {
  resolveIcon, getShapeRadiusClass,
  type AssetRoleStyle, type AssetTypeStyle, type NodePortStyle,
} from '../../lib/appearance-defaults';
import type { AssetType, AssetRole } from '../../lib/csmp-types';

// Group node — rendered for any asset that has at least one visible child
// in the current view. Acts as a translucent container with a header strip;
// xyflow positions child nodes inside automatically (their `parentId`
// points at this node).
//
// Phase 2 dropped the spatial ports: hierarchy is now expressed by visual
// nesting, so dragging spatial-out → spatial-in is dead-weight UI. Only
// the LOGICAL ports remain, used to draw coverage edges (PROTECTS /
// MONITORS / DEPENDS_ON). Reparenting is done through the AssetFormDrawer
// for now.

export const HANDLE_LOGICAL_IN = 'logical-in';
export const HANDLE_LOGICAL_OUT = 'logical-out';

// xyflow's Node generic requires `Record<string, unknown>`; using `type`
// (not `interface`) keeps GroupNodeData compatible with that constraint.
export type GroupNodeData = {
  name: string;
  assetType: AssetType;
  assetRole: AssetRole;
  criticality: number;
  childCount: number;        // total children in the data model
  visibleChildCount: number; // children currently rendered inside this group
  collapsed: boolean;
  selected: boolean;
  viewMode: 'topology' | 'all';
  roleStyle: AssetRoleStyle;
  typeStyle: AssetTypeStyle;
  portStyle: NodePortStyle;
  onToggleCollapse: (id: string) => void;
  onIsolate: (id: string) => void;
  onOpenToolbox: (id: string) => void;
  onAddChild: (id: string) => void;
};

function portShapeRadius(shape: NodePortStyle['shape'], size: number): number | string {
  if (shape === 'circle') return '50%';
  if (shape === 'rounded') return Math.max(2, Math.round(size * 0.25));
  return 0;
}

function makePortStyle(ps: NodePortStyle, active: boolean, color: string): React.CSSProperties {
  return {
    width: ps.size, height: ps.size, background: color,
    border: `${ps.borderWidth}px solid ${ps.borderColor}`,
    borderRadius: portShapeRadius(ps.shape, ps.size),
    opacity: active ? 1 : ps.disabledOpacity,
    pointerEvents: active ? 'auto' : 'none',
  };
}

export const AssetGroupNode = memo(function AssetGroupNode({
  id, data,
}: NodeProps<Node<GroupNodeData>>) {
  const r = data.roleStyle;
  const t = data.typeStyle;
  const ps = data.portStyle;
  const TypeIcon = resolveIcon(t.iconName);
  const shapeClass = getShapeRadiusClass(data.assetType);
  // Logical ports active in modes that show coverage edges. Drawing a
  // coverage edge while edges are hidden would be confusing.
  const logicalActive = data.viewMode === 'all';

  return (
    <div
      className={[
        'group relative w-full h-full shadow-sh1 hover:shadow-sh2 transition-shadow',
        shapeClass,
        data.selected ? 'ring-2 ring-a-500 ring-offset-1' : '',
      ].join(' ')}
      style={{
        // Group fill: a soft tint of the type bg so it reads as a container
        // without overwhelming child cards. Border encodes the role
        // (PROTECTED/PROTECTIVE/DUAL).
        backgroundColor: t.bg + '4d',
        borderColor: r.borderColor,
        borderWidth: r.borderWidth,
        borderStyle: r.borderStyle,
      }}
    >
      {/* Coverage edges only — one port per side, mid-header height. */}
      <Handle
        id={HANDLE_LOGICAL_IN}
        type="target"
        position={Position.Left}
        style={{ ...makePortStyle(ps, logicalActive, ps.logicalColor), top: 18 }}
        title="Coverage inbound — drop a relationship here"
      />
      <Handle
        id={HANDLE_LOGICAL_OUT}
        type="source"
        position={Position.Right}
        style={{ ...makePortStyle(ps, logicalActive, ps.logicalColor), top: 18 }}
        title="Coverage outbound — drag to create a relationship"
      />

      {/* Header strip — fits inside ELK's reserved top padding. Action
          buttons are hidden until hover/select so the resting state is calm. */}
      <header
        className="absolute top-0 left-0 right-0 h-9 px-3 flex items-center gap-2 border-b csmp-no-export"
        style={{ borderColor: r.borderColor + '66', backgroundColor: '#ffffffe6' }}
      >
        <span
          className="inline-flex items-center justify-center w-6 h-6 rounded-r1 shrink-0"
          style={{ backgroundColor: t.bg, color: t.ink }}
          title={t.abbr}
        >
          <TypeIcon size={13} />
        </span>
        <span
          className="text-[13px] font-medium text-n-900 truncate flex-1 min-w-0"
          title={data.name}
        >
          {data.name}
        </span>
        <span
          className="text-[10px] font-mono text-n-500 shrink-0 tabular-nums"
          title={`${data.visibleChildCount} of ${data.childCount} children visible`}
        >
          {data.visibleChildCount === data.childCount
            ? data.childCount
            : `${data.visibleChildCount}/${data.childCount}`}
        </span>
        <div
          className={[
            'flex items-center gap-0.5 shrink-0 transition-opacity',
            data.selected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100',
          ].join(' ')}
        >
          <button
            type="button"
            aria-label={data.collapsed ? 'Expand' : 'Collapse'}
            onClick={(e) => { e.stopPropagation(); data.onToggleCollapse(id); }}
            className="w-6 h-6 grid place-items-center rounded-r1 text-n-600 hover:text-a-700 hover:bg-n-100"
            title={data.collapsed ? `Expand (${data.childCount})` : `Collapse (${data.childCount})`}
          >
            {data.collapsed ? <ChevronRight size={13} /> : <ChevronDown size={13} />}
          </button>
          <button
            type="button"
            aria-label="Add child"
            onClick={(e) => { e.stopPropagation(); data.onAddChild(id); }}
            className="w-6 h-6 grid place-items-center rounded-r1 text-n-600 hover:text-a-700 hover:bg-n-100"
            title="Add child asset"
          >
            <Plus size={13} />
          </button>
          <button
            type="button"
            aria-label="Isolate"
            onClick={(e) => { e.stopPropagation(); data.onIsolate(id); }}
            className="w-6 h-6 grid place-items-center rounded-r1 text-n-600 hover:text-a-700 hover:bg-n-100"
            title="Isolate (show only this branch)"
          >
            <Focus size={12} />
          </button>
          <button
            type="button"
            aria-label="Open toolbox"
            onClick={(e) => { e.stopPropagation(); data.onOpenToolbox(id); }}
            className="w-6 h-6 grid place-items-center rounded-r1 text-n-600 hover:text-a-700 hover:bg-n-100"
            title="Open toolbox"
          >
            <Settings size={12} />
          </button>
        </div>
      </header>
    </div>
  );
});
