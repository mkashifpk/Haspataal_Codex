import fs from 'node:fs';const edit=(p,f)=>fs.writeFileSync(p,f(fs.readFileSync(p,'utf8')));
edit('src/App.tsx',s=>s.replace('!["imaging_repeats","imaging_outsourced"','!["bed_matrix","pending_admissions","imaging_repeats","imaging_outsourced"'));
edit('src/screens/BedMatrix.tsx',s=>s.replace('{tr(w.ward_type)} · {tr(w.gender_restriction)}','{w.ward_type === "Other" ? t("Other", "دیگر") : tr(w.ward_type)} · {w.gender_restriction === "any" ? t("All genders", "تمام اصناف") : tr(w.gender_restriction)}'));
