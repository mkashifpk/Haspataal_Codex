import {defineConfig} from 'vite';import path from 'node:path';
export default defineConfig({base:'./',define:{'process.env.NODE_ENV':JSON.stringify('production')},build:{outDir:'artifacts/community-preview-build',emptyOutDir:true,lib:{entry:path.resolve('scripts/community-preview.jsx'),formats:['es'],fileName:()=> 'community-preview.js'},rollupOptions:{output:{codeSplitting:false}}}});
