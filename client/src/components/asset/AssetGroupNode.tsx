import { memo } from 'react';
import { ChevronDown, ChevronRight, Focus, Settings } from 'lucide-react';
import { Handle, Position, type Node, type NodeProps } from '@xyflow/react';
import {
  resolveIcon, getShapeRadiusClass,
  type AssetRoleStyle, type AssetTypeStyle, type NodePortStyle,
} from '../../lib/appearance-defaults';
import type { AssetType, AssetRole } from '../../lib/csmp-types';

// Group node — rendered for any asset that has at least one visible child
// in the current view. Acts as a translucent container with a header strip;
// xyflow positions child nodes inside automatically (their `parentId`
// points at this node and `extent: 'parent'` constrains drag).

export const HANDLE_SPATIAL_IN = 'spatial-in';
export const HANDLE_SPATIAL_OUT = 'spatial-out';
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
  viewMode: 'topology' | 'coverage' | 'both';
  roleStyle: AssetRoleStyle;
  typeStyle: AssetTypeStyle;
  portStyle: NodePortStyle;
  onToggleCollapse: (id: string) => void;
  onIsolate: (id: string) => void;
  onOpenToolbox: (id: string) => void;
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
  const spatialActive = data.viewMode !== 'coverage';
  const logicalActive = data.viewMode !== 'topology';

  return (
    <div
      className={[
        'relative w-full h-full',
        shapeClass,
        data.selected ? 'ring-2 ring-a-500 ring-offset-1' : '',
      ].join(' ')}
      style={{
        // Translucent fill so children stand out; group color uses the
        // asset-type background at low alpha. Border encodes the role
        // (PROTECTED/PROTECTIVE/DUAL).
        backgroundColor: t.bg + 'cc',
        borderColor: r.borderColor,
        borderWidth: r.borderWidth,
        borderStyle: r.borderStyle,
      }}
    >
      {/* Spatial inbound (parent container of this group). */}
      <Handle
        id={HANDLE_SPATIAL_IN}
        type="target"
        position={Position.Left}
        style={{ ...makePortStyle(ps, spatialActive, ps.spatialColor), top: 14 }}
        title="Spatial inbound"
      />
      <Handle
        id={HANDLE_LOGICAL_IN}
        type="target"
        position={Position.Left}
        style={{ ...makePortStyle(ps, logicalActive, ps.logicalColor), top: 26 }}
        title="Coverage inbound"
      />
      <Handle
        id={HANDLE_SPATIAL_OUT}
        type="source"
        position={Position.Right}
        style={{ ...makePortStyle(ps, spatialActive, ps.spatialColor), top: 14 }}
        title="Spatial outbound"
      />
      <Handle
        id={HANDLE_LOGICAL_OUT}
        type="source"
        position={Position.Right}
        style={{ ...makePortStyle(ps, logicalActive, ps.logicalColor), top: 26 }}
        title="Coverage outbound"
      />

      {/* Header strip — fits inside ELK's reserved top padding (36 px). */}
      <header
        className="absolute top-0 left-0 right-0 h-8 px-2 flex items-center gap-1.5 border-b csmp-no-export"
        style={{ borderColor: r.borderColor, backgroundColor: '#ffffffcc' }}
      >
        <span
          className="inline-flex items-center justify-center w-5 h-5 rounded-r1 shrink-0"
          style={{ backgroundColor: t.bg, color: t.ink }}
          title={t.abbr}
        >
          <TypeIcon size={12} />
        </span>
        <span
          className="text-[12.5px] font-medium text-n-900 truncate flex-1 min-w-0"
          title={data.name}
        >
          {data.name}
        </span>
        <span
          className="text-[10px] font-mono text-n-500 shrink-0"
          title={`${data.visibleChildCount} of ${data.childCount} children visible`}
        >
          {data.visibleChildCount}/{data.childCount}
        </span>
        <button
          type="button"
          aria-label={data.collapsed ? 'Expand' : 'Collapse'}
          onClick={(e) => { e.stopPropagation(); data.onToggleCollapse(id); }}
          className="w-5 h-5 grid place-items-center text-n-600 hover:text-a-700 shrink-0"
          title={data.collapsed ? `Expand (${data.childCount})` : `Collapse (${data.childCount})`}
        >
          {data.collapsed ? <ChevronRight size={12} /> : <ChevronDown size={12} />}
        </button>
        <button
          type="button"
          aria-label="Isolate"
          onClick={(e) => { e.stopPropagation(); data.onIsolate(id); }}
          className="w-5 h-5 grid place-items-center text-n-600 hover:text-a-700 shrink-0"
          title="Isolate (show only this branch)"
        >
          <Focus size={11} />
        </button>
        <button
          type="button"
          aria-label="Open toolbox"
          onClick={(e) => { e.stopPropagation(); data.onOpenToolbox(id); }}
          className="w-5 h-5 grid place-items-center text-n-600 hover:text-a-700 shrink-0"
          title="Open toolbox"
        >
          <Settings size={11} />
        </button>
      </header>
    </div>
  );
});
