// The DEV database was reinstalled on this build. Preferences and connection trust
// survive; record references, pending writes and offline punches cannot cross it.
export function resetDevDataset(storage:Storage) {
 const epoch='2026-11-05:7429acf';
 if(storage.getItem('haspataal.dev-dataset')===epoch)return;
 for(const key of Object.keys(storage))if(key.startsWith('haspataal.facility-apply:')||key==='haspataal_station_offline_queue')storage.removeItem(key);
 storage.setItem('haspataal.dev-dataset',epoch);
}
