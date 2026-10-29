import { WardAdmission, type WardProps } from "../ward-admission";
import { EducationForm } from "./PatientEducation";
import { bilingual as t } from "../i18n";
export function WardEducation(props: WardProps) {
  return (
    <section>
      <h1>{t("Ward health education", "وارڈ میں صحت کی رہنمائی")}</h1>
      <p>
        {t(
          "For the ward nurse after actual guidance: identify the patient, record the method and recipient, and keep the author-stamped history.",
          "اصل رہنمائی کے بعد نرس مریض چیک کرکے طریقہ و وصول کنندہ درج کرے اور مصنف کی مہر والی تاریخ محفوظ رکھے۔",
        )}
      </p>
      <WardAdmission {...props} screenId="patient_education_ward">
        {(ctx) => (
          <EducationForm
            user={props.user}
            ctx={ctx}
            revision={ctx.revision}
            readOnly={ctx.view === "records"}
            connected={props.connected && props.stream === "Live"}
            timeZone={props.timeZone}
            screenId="patient_education_ward"
            beforeSave={() => ctx.preflight("education.give")}
          />
        )}
      </WardAdmission>
    </section>
  );
}
