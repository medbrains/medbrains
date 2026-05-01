import type { ReactNode } from "react";
import s from "./inputs.module.scss";

export interface DrugToken {
  drug: string;
  dose: string;
  freq: string;
  duration: string;
  instruction?: string;
}

interface AllergyAlert {
  reaction: string;
  suggest?: string;
}

interface DrugRxComposerProps {
  rx: DrugToken;
  allergyAlert?: AllergyAlert;
  trailing?: ReactNode;
}

export function DrugRxComposer({ rx, allergyAlert, trailing }: DrugRxComposerProps) {
  return (
    <div>
      <div className={s.drugInput}>
        <span className={`${s.tok} ${s.drug}`}>{rx.drug}</span>
        <span className={`${s.tok} ${s.dose}`}>{rx.dose}</span>
        <span className={s.conn}>·</span>
        <span className={`${s.tok} ${s.freq}`}>{rx.freq}</span>
        <span className={s.conn}>for</span>
        <span className={`${s.tok} ${s.dur}`}>{rx.duration}</span>
        {rx.instruction && <span className={s.conn}>— {rx.instruction}</span>}
        {trailing}
      </div>
      {allergyAlert && (
        <div className={s.allergyStrip}>
          <span className={s.lab}>Allergy match</span>
          <div className={s.msg}>
            {allergyAlert.reaction}
            {allergyAlert.suggest && (
              <>
                {" "}
                Suggest <b>{allergyAlert.suggest}</b>.
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
