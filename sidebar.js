const theme = new URLSearchParams(location.search).get('theme');
document.documentElement.dataset.theme = theme === 'light' ? 'light' : 'dark';
