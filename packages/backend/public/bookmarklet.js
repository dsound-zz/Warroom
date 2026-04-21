javascript:(function(){
  var domain = window.location.hostname.replace(/^www\./, '');
  var reason = prompt('DNA reason?', 'other');
  if (!reason) return;
  fetch('http://localhost:8000/api/do-not-apply/quick-add', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ domain: domain, reasonCategory: reason })
  }).then(function(r) {
    return r.json();
  }).then(function(d) {
    alert(d.error || 'Added ' + domain + ' to Do Not Apply');
  }).catch(function() {
    alert('Failed to add');
  });
})();
