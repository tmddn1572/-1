// 서비스 워커 등록 (오프라인 캐싱)
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('service-worker.js').catch(() => {});
  });
}
