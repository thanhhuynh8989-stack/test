import { initConfigModule } from './modules/config.js';
import { initExtractorModule } from './modules/extractor.js';
import { initLibraryModule } from './modules/library.js';

document.addEventListener('DOMContentLoaded', () => {
  initConfigModule();
  initExtractorModule();
  initLibraryModule();
});
