import { memo } from 'react';
import { ArrowLeftRight, ArrowUpDown, ChevronDown, ChevronRight, ChevronUp, Focus, Plus, Settings, Sparkles } from 'lucide-react';
import { Handle, Position, type Node, type NodeProps } from '@xyflow/react';
import {
  resolveIcon, getShapeRadiusClass,
  type AssetRoleStyle, type AssetTypeStyle, type NodePortStyle,
} from '../../lib/appearance-defaults';
import type { AssetType, AssetRole, LayoutOrientation } from '../../lib/csmp-types';

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

// One universal port per side — see RelationshipsPage for the routing
// rationale. Same dot is source and target via `isConnectableStart` +
// `isConnectableEnd` plus `connectionMode='loose'` on the canvas. Four
// sides so the picker can route edges around the container instead of
// straight through it.
export const HANDLE_LEFT = 'port-left';
export const HANDLE_RIGHT = 'port-right';
export const HANDLE_TOP = 'port-top';
export const HANDLE_BOTTOM = 'port-bottom';

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
  // True for groups outside the focus subtree while isolation is active —
  // the renderer fades them to read as "context". Optional so non-isolating
  // callers can omit it.
  isNeighbor?: boolean;
  // Focus highlight: when set, this group is part of the 1-hop neighbourhood
  // around a hovered/selected node or edge. We do NOT honor `dimmed` on
  // group containers — CSS opacity inherits onto their children, which would
  // crush legibility of any leaf still in focus.
  highlighted?: boolean;
  dimmed?: boolean;
  // True while the user is dragging another node and this group is the
  // matched drop target — adds a ring so the user sees where the drop
  // will land before they release.
  isDropTarget?: boolean;
  // True while the user is actively dragging this group node.
  isDragging?: boolean;
  canMoveUp: boolean;
  canMoveDown: boolean;
  viewMode: 'topology' | 'all';
  // Lane-grid orientation for THIS group's children:
  //   AUTO       → alternate by depth (depth 0 = horizontal, 1 = vertical, …)
  //   HORIZONTAL → children flow left→right inside this container
  //   VERTICAL   → children stack top→bottom
  // Cycled via the H/V/A header button.
  layoutOrientation: LayoutOrientation;
  roleStyle: AssetRoleStyle;
  typeStyle: AssetTypeStyle;
  portStyle: NodePortStyle;
  onToggleCollapse: (id: string) => void;
  onIsolate: (id: string) => void;
  onOpenToolbox: (id: string) => void;
  onAddChild: (id: string) => void;
  onCycleOrientation: (id: string, current: LayoutOrientation) => void;
  onMoveUp: (id: string) => void;
  onMoveDown: (id: string) => void;
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
        'group relative w-full h-full shadow-sh1 hover:shadow-sh2 transition-[shadow,transform]',
        shapeClass,
        data.isDragging ? 'shadow-sh3 scale-[1.03] z-50' : '',
        data.selected ? 'ring-2 ring-a-500 ring-offset-1' : '',
        data.isDropTarget ? 'ring-2 ring-a-500 ring-offset-2' : '',
        data.isNeighbor ? 'opacity-55 hover:opacity-100' : '',
        data.highlighted && !data.selected && !data.isDropTarget ? 'shadow-sh2' : '',
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
      {/* Universal coverage port per side, mid-edge so the router has
          a proper anchor on each face of the container. Pinning ports
          inside the header was OK with two ports total but breaks the
          4-side picker — edges drawn from a child cousin would still
          tunnel through the header rather than route around. */}
      <Handle
        id={HANDLE_LEFT}
        type="source"
        position={Position.Left}
        isConnectableStart={logicalActive}
        isConnectableEnd={logicalActive}
        style={{ ...makePortStyle(ps, logicalActive, ps.logicalColor), top: '50%' }}
        title="Coverage port (left)"
      />
      <Handle
        id={HANDLE_RIGHT}
        type="source"
        position={Position.Right}
        isConnectableStart={logicalActive}
        isConnectableEnd={logicalActive}
        style={{ ...makePortStyle(ps, logicalActive, ps.logicalColor), top: '50%' }}
        title="Coverage port (right)"
      />
      <Handle
        id={HANDLE_TOP}
        type="source"
        position={Position.Top}
        isConnectableStart={logicalActive}
        isConnectableEnd={logicalActive}
        style={{ ...makePortStyle(ps, logicalActive, ps.logicalColor), left: '50%' }}
        title="Coverage port (top)"
      />
      <Handle
        id={HANDLE_BOTTOM}
        type="source"
        position={Position.Bottom}
        isConnectableStart={logicalActive}
        isConnectableEnd={logicalActive}
        style={{ ...makePortStyle(ps, logicalActive, ps.logicalColor), left: '50%' }}
        title="Coverage port (bottom)"
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
          className="text-[13px] font-medium text-n-900 leading-tight break-words line-clamp-2 flex-1 min-w-0"
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
            aria-label={`Layout: ${data.layoutOrientation === 'AUTO' ? 'auto (alternates by depth)' : data.layoutOrientation === 'HORIZONTAL' ? 'horizontal' : 'vertical'}. Click to cycle.`}
            onClick={(e) => { e.stopPropagation(); data.onCycleOrientation(id, data.layoutOrientation); }}
            className="w-6 h-6 grid place-items-center rounded-r1 text-n-600 hover:text-a-700 hover:bg-n-100"
            title={
              data.layoutOrientation === 'AUTO'
                ? 'Lane: Auto (click → Horizontal)'
                : data.layoutOrientation === 'HORIZONTAL'
                  ? 'Lane: Horizontal (click → Vertical)'
                  : 'Lane: Vertical (click → Auto)'
            }
          >
            {data.layoutOrientation === 'AUTO' ? (
              <Sparkles size={12} />
            ) : data.layoutOrientation === 'HORIZONTAL' ? (
              <ArrowLeftRight size={13} />
            ) : (
              <ArrowUpDown size={13} />
            )}
          </button>
          {(data.canMoveUp || data.canMoveDown) && (
            <>
              <button
                type="button"
                aria-label="Move earlier in lane"
                onClick={(e) => { e.stopPropagation(); data.onMoveUp(id); }}
                disabled={!data.canMoveUp}
                className="w-6 h-6 grid place-items-center rounded-r1 text-n-600 hover:text-a-700 hover:bg-n-100 disabled:opacity-30 disabled:pointer-events-none"
                title="Move earlier in lane"
              >
                <ChevronUp size={13} />
              </button>
              <button
                type="button"
                aria-label="Move later in lane"
                onClick={(e) => { e.stopPropagation(); data.onMoveDown(id); }}
                disabled={!data.canMoveDown}
                className="w-6 h-6 grid place-items-center rounded-r1 text-n-600 hover:text-a-700 hover:bg-n-100 disabled:opacity-30 disabled:pointer-events-none"
                title="Move later in lane"
              >
                <ChevronDown size={13} />
              </button>
            </>
          )}
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
