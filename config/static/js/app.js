/* Restaurant POS - shared app JavaScript */

(function () {
  "use strict";

  /* Sidebar toggle (mobile / tablet) */
  var sidebarToggle = document.querySelector(".topbar-toggle");
  var sidebar = document.querySelector(".sidebar");
  var backdrop = document.querySelector(".sidebar-backdrop");

  function openSidebar() {
    if (!sidebar) return;
    sidebar.classList.add("open");
    if (backdrop) backdrop.classList.add("show");
  }

  function closeSidebar() {
    if (!sidebar) return;
    sidebar.classList.remove("open");
    if (backdrop) backdrop.classList.remove("show");
  }

  if (sidebarToggle) {
    sidebarToggle.addEventListener("click", function () {
      if (sidebar && sidebar.classList.contains("open")) {
        closeSidebar();
      } else {
        openSidebar();
      }
    });
  }

  if (backdrop) {
    backdrop.addEventListener("click", closeSidebar);
  }

  /* Toasts ---- render Django messages as toast notifications */
  var toastContainer = document.querySelector(".toast-container");

  function toast(message, level) {
    level = level || "info";
    var container = toastContainer || null;
    if (!container) {
      container = document.createElement("div");
      container.className = "toast-container";
      document.body.appendChild(container);
    }

    var el = document.createElement("div");
    el.className = "toast toast-" + level;
    el.appendChild(document.createTextNode(message));

    var close = document.createElement("button");
    close.className = "toast-close";
    close.setAttribute("aria-label", "Dismiss");
    close.textContent = "\u00d7";
    close.addEventListener("click", function () {
      container.removeChild(el);
    });
    el.appendChild(close);

    container.appendChild(el);
    setTimeout(function () {
      if (el.parentElement === container) {
        container.removeChild(el);
      }
    }, 5000);
  }

  window.POS = {
    toast: toast,
  };

  /* Render Django messages as toasts (debug only; not for production flow when
     duplicates with a dedicated toast pipeline appear in later stages). */
  var messageContainer = document.getElementById("django-messages");
  if (messageContainer && window.JSON && typeof window.JSON.parse === "function") {
    try {
      var messages = JSON.parse(messageContainer.textContent || "[]");
      for (var i = 0; i < messages.length; i++) {
        toast(messages[i].message, messages[i].level);
      }
    } catch (err) {
      /* ignore malformed message payload */
    }
  }

  /* Auto-hide generic dismissible alerts */
  var dismissible = document.querySelectorAll(".alert-auto");
  for (var a = 0; a < dismissible.length; a++) {
    var node = dismissible[a];
    setTimeout(function () {
      setTimeout(function () {
        if (node.parentElement) node.parentElement.removeChild(node);
      }, 300);
    }, 6000);
  }
})();