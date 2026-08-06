// lint-staged config — oxlint ignores `scripts/**` (see .oxlintrc.json), so it
// must not receive script files, or it exits 1 with "No files found to lint".
// oxfmt formats everything.
export default {
  '*.{js,ts,jsx,tsx}': (files) => {
    const fmt = `oxfmt ${files.join(' ')}`;
    const lintable = files.filter((f) => !f.split('/').includes('scripts'));
    return lintable.length > 0 ? [fmt, `oxlint --fix ${lintable.join(' ')}`] : [fmt];
  }
};
