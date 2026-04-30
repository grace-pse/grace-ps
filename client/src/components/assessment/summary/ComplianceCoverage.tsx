import type { ComplianceTag } from '../../../lib/csmp-types';
import { COMPLIANCE_TAG_LABEL } from '../../../lib/csmp-types';
import { Card } from '../../hifi/Card';
import { CardHeader } from '../../hifi/CardHeader';
import { Pill } from '../../hifi/Pill';

interface ComplianceCoverageProps {
  items: Array<{ tag: ComplianceTag; threatCount: number }>;
  totalThreats: number;
}

export function ComplianceCoverage({ items, totalThreats }: ComplianceCoverageProps) {
  return (
    <Card>
      <CardHeader
        title="Compliance coverage"
        subtitle={items.length > 0
          ? `${items.length} framework${items.length === 1 ? '' : 's'} touched across threats`
          : 'No compliance tags applied'}
      />
      <div className="px-[14px] py-3">
        {items.length === 0 ? (
          <div className="text-[12px] text-n-500">
            Threats in this assessment are not tagged against any compliance framework.
          </div>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {items.map((it) => (
              <Pill key={it.tag} variant="accent">
                <span className="font-medium">{COMPLIANCE_TAG_LABEL[it.tag]}</span>
                <span className="font-mono text-a-700/70 ml-1">
                  {it.threatCount}/{totalThreats}
                </span>
              </Pill>
            ))}
          </div>
        )}
      </div>
    </Card>
  );
}
