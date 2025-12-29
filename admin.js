// =======================================================
// PROTECCIÓN DE ACCESO
// =======================================================
auth.onAuthStateChanged(user => {
  if (!user) location.href = "admin-login.html";
});

function logout() {
  auth.signOut();
}

// =======================================================
// VARIABLES GLOBALES
// =======================================================
let editId = null;
let prevSize = null;

const appsList = document.getElementById("appsList");
const appsListWrap = document.getElementById("appsListWrap");
const loadingMoreEl = document.getElementById("loadingMore");
const noMoreEl = document.getElementById("noMore");
const searchInput = document.getElementById("searchInput");

// Paging
const PAGE_SIZE = 10;
let lastVisible = null;
let loading = false;
let exhausted = false;
let inSearchMode = false;

// Cache local (items cargados)
let loadedAppsCache = [];

// =======================================================
// CARGA INICIAL
// =======================================================
function resetPagination() {
  lastVisible = null;
  exhausted = false;
  loadedAppsCache = [];
  appsList.innerHTML = "";
}

function loadInitialApps() {
  resetPagination();
  inSearchMode = false;
  loadMoreApps();
}

function loadMoreApps() {
  if (loading || exhausted || inSearchMode) return;
  loading = true;
  loadingMoreEl.classList.remove("hidden");

  let query = db.collection("apps").orderBy("fecha", "desc").limit(PAGE_SIZE);

  if (lastVisible) {
    query = db.collection("apps").orderBy("fecha", "desc").startAfter(lastVisible).limit(PAGE_SIZE);
  }

  query.get()
    .then(snap => {
      if (snap.empty) {
        exhausted = true;
        noMoreEl.classList.remove("hidden");
        loadingMoreEl.classList.add("hidden");
        loading = false;
        return;
      }

      const docs = snap.docs;
      lastVisible = docs[docs.length - 1];
      const items = docs.map(d => d.data());
      loadedAppsCache = loadedAppsCache.concat(items);
      renderApps(items, true);

      if (items.length < PAGE_SIZE) {
        exhausted = true;
        noMoreEl.classList.remove("hidden");
      }

      loadingMoreEl.classList.add("hidden");
      loading = false;
    })
    .catch(err => {
      console.error("Error cargando apps:", err);
      loadingMoreEl.classList.add("hidden");
      loading = false;
    });
}

// =======================================================
// RENDERIZADO DE FILAS
// =======================================================
function renderApps(items, append = false) {
  let html = items.map(a => {
    return `
      <tr id="app-row-${a.id}">
        <td><img src="${a.icono || a.imagen || ''}" class="table-icon" alt="icono"></td>
        <td>${escapeHtml(a.nombre || '')}</td>
        <td>${escapeHtml(a.categoria || '')}</td>
        <td>${escapeHtml(a.version || '')}</td>
        <td>
          <button class="btn-edit" onclick="cargarParaEditar('${a.id}')">✏️ Editar</button>
          <button class="btn-delete" onclick="eliminarApp('${a.id}')">🗑 Eliminar</button>
        </td>
      </tr>
    `;
  }).join("");

  if (append) {
    appsList.insertAdjacentHTML('beforeend', html);
  } else {
    appsList.innerHTML = html;
  }
}

function escapeHtml(str) {
  return (str + '').replace(/[&<>"'`=\/]/g, function(s) {
    return ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
      '/': '&#x2F;',
      '`': '&#x60;',
      '=': '&#x3D;'
    })[s];
  });
}

// =======================================================
// BÚSQUEDA POR NOMBRE
// =======================================================
let searchTimer = null;
searchInput.addEventListener('input', e => {
  const term = e.target.value.trim();
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => {
    if (!term) {
      inSearchMode = false;
      noMoreEl.classList.add("hidden");
      loadInitialApps();
      return;
    }
    performSearch(term);
  }, 350);
});

function performSearch(term) {
  inSearchMode = true;
  loadingMoreEl.classList.remove("hidden");
  noMoreEl.classList.add("hidden");
  appsList.innerHTML = "";

  const start = term;
  const end = term + '\uf8ff';

  db.collection("apps").orderBy("nombre").startAt(start).endAt(end).limit(100).get()
    .then(snap => {
      if (snap.empty) {
        appsList.innerHTML = '<tr><td colspan="5" style="padding:12px;color:#94a3b8">No se encontraron aplicaciones</td></tr>';
        loadingMoreEl.classList.add("hidden");
        return;
      }
      const items = snap.docs.map(d => d.data());
      items.sort((a,b) => (b.fecha || 0) - (a.fecha || 0));
      renderApps(items, false);
      loadingMoreEl.classList.add("hidden");
    })
    .catch(err => {
      console.error("Error en búsqueda:", err);
      loadingMoreEl.classList.add("hidden");
    });
}

// =======================================================
// SCROLL INFINITO
// =======================================================
appsListWrap.addEventListener('scroll', () => {
  if (inSearchMode) return;
  const { scrollTop, scrollHeight, clientHeight } = appsListWrap;
  if (scrollTop + clientHeight >= scrollHeight - 160) {
    loadMoreApps();
  }
});

// =======================================================
// CARGAR APP PARA EDITAR
// =======================================================
function cargarParaEditar(id) {
  editId = id;
  document.getElementById("formTitle").textContent = "✏️ Editar Aplicación";
  document.getElementById("subirBtn").textContent = "GUARDAR";
  document.getElementById("cancelarBtn").classList.remove("hidden");

  db.collection("apps").doc(id).get().then(doc => {
    const a = doc.data();

    document.getElementById("nombre").value = a.nombre || '';
    document.getElementById("descripcion").value = a.descripcion || '';
    document.getElementById("version").value = a.version || '';
    document.getElementById("categoria").value = a.categoria || '';
    document.getElementById("idioma").value = a.idioma || '';
    document.getElementById("tipo").value = a.tipo || '';
    document.getElementById("internet").value = a.internet || 'offline';

    document.getElementById("sistema").value = a.sistemaOperativo || "";
    document.getElementById("requisitos").value = a.requisitos || "";
    document.getElementById("fechaAct").value = a.fechaActualizacion || "";
    document.getElementById("edad").value = a.edad || "";
    document.getElementById("anuncios").value = a.anuncios || "no";
    document.getElementById("privacidad").value = a.privacidadUrl || "";

    document.getElementById("imagenUrl").value = a.imagen || "";
    document.getElementById("capturasUrl").value = a.imgSecundarias ? a.imgSecundarias.join(",") : "";
    document.getElementById("iconoUrl").value = a.icono || "";
    document.getElementById("apkUrl").value = a.apk || "";

    document.getElementById("packageName").value = a.packageName || "";

    
    document.getElementById("size").value = a.size || "";
    prevSize = a.size || null;

    // NUEVOS CAMPOS DE ENLACES
    document.getElementById("playstoreUrl").value = a.playstoreUrl || "";
    document.getElementById("uptodownUrl").value = a.uptodownUrl || "";
    document.getElementById("megaUrl").value = a.megaUrl || "";
    document.getElementById("mediafireUrl").value = a.mediafireUrl || "";

    window.scrollTo({ top: 0, behavior: "smooth" });
  });
}

// =======================================================
// CARGAR FORMULARIO DE NUEVA APP
// =======================================================
function cargarFormularioNuevo() {
  limpiarFormulario();
  document.getElementById("formTitle").textContent = "➕ Nueva Aplicación";
  document.getElementById("subirBtn").textContent = "SUBIR APP";
  document.getElementById("cancelarBtn").classList.add("hidden");

  const inputs = document.querySelectorAll("input, textarea, select");
  inputs.forEach(input => {
    input.addEventListener('input', function() {
      document.getElementById("cancelarBtn").classList.remove("hidden");
    });
  });
}

// =======================================================
// GUARDAR / EDITAR APP
// =======================================================
async function guardarApp() {
  const btn = document.getElementById("subirBtn");
  const estado = document.getElementById("estado");

  btn.disabled = true;
  estado.textContent = "Guardando...";

  const campos = {
    nombre: nombre.value.trim(),
    descripcion: descripcion.value.trim(),
    version: version.value.trim(),
    categoria: categoria.value.trim(),
    idioma: idioma.value.trim(),
    tipo: tipo.value.trim(),
    internet: internet.value,
    sistemaOperativo: sistema.value.trim(),
    requisitos: requisitos.value.trim(),
    fechaActualizacion: fechaAct.value,
    edad: edad.value.trim(),
    anuncios: anuncios.value,
    privacidadUrl: privacidad.value.trim(),
    imagen: imagenUrl.value.trim(),
    apk: apkUrl.value.trim(),
    size: size.value.trim() || "N/A",
    imgSecundarias: capturasUrl.value.split(",").map(u => u.trim()).filter(u => u !== ""),
    // NUEVOS CAMPOS
    playstoreUrl: playstoreUrl.value.trim(),
    uptodownUrl: uptodownUrl.value.trim(),
    megaUrl: megaUrl.value.trim(),
    mediafireUrl: mediafireUrl.value.trim(),
    packageName: packageName.value.trim()

  };

  if (!campos.nombre || !campos.descripcion || !campos.version) {
    alert("Completa al menos nombre, descripción y versión.");
    btn.disabled = false;
    estado.textContent = "";
    return;
  }

  const imagenFile = imagen.files[0];
  const apkFile = apk.files[0];
  const capturasFiles = capturas.files;
  const storageRef = firebase.storage().ref();
  let promesas = [];

  if (imagenFile) {
    promesas.push(
      storageRef.child("images/" + imagenFile.name)
        .put(imagenFile)
        .then(r => r.ref.getDownloadURL())
        .then(url => campos.imagen = url)
    );
  }

  if (apkFile) {
    promesas.push(
      storageRef.child("apk/" + apkFile.name)
        .put(apkFile)
        .then(r => r.ref.getDownloadURL())
        .then(url => campos.apk = url)
    );
  }

  if (capturasFiles.length > 0) {
    campos.imgSecundarias = [];
    promesas.push(
      Promise.all(
        [...capturasFiles].map(file =>
          storageRef.child("capturas/" + file.name)
          .put(file)
          .then(r => r.ref.getDownloadURL())
          .then(url => campos.imgSecundarias.push(url))
        )
      )
    );
  }

  await Promise.all(promesas);

  let id = editId || db.collection("apps").doc().id;

  const data = {
    id,
    ...campos,
    fecha: Date.now()
  };

  db.collection("apps").doc(id).set(data, { merge: true })
    .then(() => {
      estado.textContent = "Guardado ✔";
      btn.disabled = false;
      editId = null;
      document.getElementById("formTitle").textContent = "➕ Nueva Aplicación";
      btn.textContent = "SUBIR APP";
      limpiarFormulario();
      if (!inSearchMode) {
        loadInitialApps();
      } else {
        const currentSearch = searchInput.value.trim();
        if (currentSearch) performSearch(currentSearch);
      }
    })
    .catch(err => {
      estado.textContent = "Error: " + err.message;
      btn.disabled = false;
    });
}

// =======================================================
// LIMPIAR FORMULARIO
// =======================================================
function limpiarFormulario() {
  const inputs = document.querySelectorAll("input, textarea, select");
  inputs.forEach(i => i.value = "");

  categoria.value = "Educación";
  tipo.value = "Gratis";
  internet.value = "offline";
  anuncios.value = "no";

  const imagenEl = document.getElementById("imagen");
  const apkEl = document.getElementById("apk");
  const capturasEl = document.getElementById("capturas");
  if (imagenEl) imagenEl.value = "";
  if (apkEl) apkEl.value = "";
  if (capturasEl) capturasEl.value = "";

  prevSize = null;
}

// =======================================================
// Cancelar edición o nueva aplicación
// =======================================================
function cancelarEdicion() {
  limpiarFormulario();
  document.getElementById("formTitle").textContent = "➕ Nueva Aplicación";
  document.getElementById("subirBtn").textContent = "SUBIR APP";
  document.getElementById("cancelarBtn").classList.add("hidden");
  editId = null;
}

// =======================================================
// Inicializar carga al abrir la página
// =======================================================
document.addEventListener('DOMContentLoaded', () => {
  loadInitialApps();
  cargarFormularioNuevo();
  updateFileName('imagen', 'imagenLabel');
  updateFileName('apk', 'apkLabel');
  updateFileName('capturas', 'capturasLabel');
});

// =======================================================
// Función para actualizar el nombre del archivo en los botones de selección
// =======================================================
function updateFileName(inputId, labelId) {
  const input = document.getElementById(inputId);
  const label = document.getElementById(labelId);
  
  input.addEventListener('change', function() {
    const fileName = input.files[0] ? input.files[0].name : 'Seleccionar';
    label.textContent = fileName;
  });
}
