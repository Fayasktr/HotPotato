function filterTable(tableId, inputId) {
  var input = document.getElementById(inputId);
  if (!input) return;
  var filter = input.value.toLowerCase();
  var table = document.getElementById(tableId);
  if (!table) return;
  var tr = table.getElementsByTagName("tr");

  for (var i = 0; i < tr.length; i++) {
    // Skip headers
    if (tr[i].getElementsByTagName("th").length > 0) continue;
    
    var td = tr[i].getElementsByTagName("td");
    var match = false;
    
    for (var j = 0; j < td.length; j++) {
      if (td[j]) {
        // Skip searching inside "Actions" column if it exists to avoid matching button text like "Delete"
        var dataLabel = td[j].getAttribute("data-label");
        if (dataLabel === "Actions") continue;

        var txtValue = td[j].textContent || td[j].innerText;
        if (txtValue.toLowerCase().indexOf(filter) > -1) {
          match = true;
          break;
        }
      }
    }
    
    if (match) {
      tr[i].style.display = ""; // falls back to CSS
    } else {
      tr[i].style.display = "none";
    }
  }
}
