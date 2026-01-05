// =======================================================
// PROTECCIÓN DE ACCESO
// =======================================================
auth.onAuthStateChanged(user => {
  if (!user || user.email !== "des.amt.01@gmail.com") {
    auth.signOut();
    location.href = "index.html";
  }
});

window.logout = function () {
  auth.signOut().then(() => {
    location.href = "index.html";
  });
};

// =======================================================
// VARIABLES GLOBALES
// =======================================================
let editId = null;
let prevSize = null;
let isFormModified = false; // Nueva variable para rastrear si el formulario tiene cambios

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
// CARGA INICIAL Y DETECCIÓN DE CAMBIOS EN FORMULARIO
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
// DETECCIÓN DE CAMBIOS EN FORMULARIO PARA NUEVA APP
// =======================================================
function setupFormChangeListeners() {
  const formFields = [
    'nombre', 'descripcion', 'version', 'categoria', 'idioma', 'tipo',
    'sistema', 'requisitos', 'fechaAct', 'edad', 'privacidad',
    'imagenUrl', 'capturasUrl', 'iconoUrl', 'apkUrl', 'packageName',
    'size', 'playstoreUrl', 'uptodownUrl', 'megaUrl', 'mediafireUrl'
  ];

  formFields.forEach(fieldId => {
    const field = document.getElementById(fieldId);
    if (field) {
      // Para campos de texto
      if (field.type === 'text' || field.type === 'textarea' || field.tagName === 'SELECT') {
        field.addEventListener('input', handleFormChange);
      }
      // Para campos de fecha
      if (field.type === 'date') {
        field.addEventListener('change', handleFormChange);
      }
    }
  });

  // Para campos de archivo
  const fileFields = ['imagen', 'apk', 'capturas'];
  fileFields.forEach(fieldId => {
    const field = document.getElementById(fieldId);
    if (field) {
      field.addEventListener('change', handleFormChange);
    }
  });
}

function handleFormChange() {
  // Solo activar si NO estamos editando una app existente
  if (!editId && !isFormModified) {
    isFormModified = true;
    showCancelButtonForNewApp();
  }
}

function showCancelButtonForNewApp() {
  const cancelBtn = document.getElementById('cancelarBtn');
  if (cancelBtn && cancelBtn.classList.contains('hidden')) {
    cancelBtn.classList.remove('hidden');
  }
}

function hideCancelButton() {
  const cancelBtn = document.getElementById('cancelarBtn');
  if (cancelBtn && !cancelBtn.classList.contains('hidden')) {
    cancelBtn.classList.add('hidden');
  }
}

// =======================================================
// RENDERIZADO DE FILAS (MODIFICADO PARA USAR SLUG)
// =======================================================
function renderApps(items, append = false) {
  let html = items.map(a => {
    // Usar slug si existe, si no, usar ID como fallback
    const appSlug = a.slug || a.id;
    return `
      <tr id="app-row-${a.id}">
        <td><img src="${a.icono || a.imagen || ''}" class="table-icon" alt="icono"></td>
        <td>
          <a href="app-detail.html?app=${encodeURIComponent(appSlug)}" 
             target="_blank" 
             class="app-link">
            ${escapeHtml(a.nombre || '')}
          </a>
        </td>
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
      '=': '&#3D;'
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
  isFormModified = false; // Resetear estado de cambios
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
}


function makeSlug(text) {
  return text
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

 
// =======================================================
// GUARDAR / EDITAR APP (MODIFICADO PARA USAR SLUG EN URL)
// =======================================================
async function guardarApp() {
  const btn = document.getElementById("subirBtn");
  const estado = document.getElementById("estado");
  const btnOriginalText = btn.textContent;

  // Validar campos obligatorios
  const nombreVal = document.getElementById("nombre").value.trim();
  const descripcionVal = document.getElementById("descripcion").value.trim();
  const versionVal = document.getElementById("version").value.trim();
  
  if (!nombreVal || !descripcionVal || !versionVal) {
    alert("Por favor completa: Nombre, Descripción y Versión");
    return;
  }

  // Función para crear slug
  function createSlug(text) {
    return text
      .toLowerCase()
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9\s-]/g, "")
      .trim()
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .substring(0, 100);
  }

  // Cambiar estado
  btn.disabled = true;
  btn.textContent = "GUARDANDO...";
  estado.textContent = "Guardando...";
  estado.style.color = "#3b82f6";

  try {
    // Recoger datos
    const campos = {
      nombre: nombreVal,
      descripcion: descripcionVal,
      version: versionVal,
      categoria: document.getElementById("categoria").value.trim(),
      idioma: document.getElementById("idioma").value.trim(),
      tipo: document.getElementById("tipo").value.trim(),
      internet: document.getElementById("internet").value,
      sistemaOperativo: document.getElementById("sistema").value.trim(),
      requisitos: document.getElementById("requisitos").value.trim(),
      fechaActualizacion: document.getElementById("fechaAct").value,
      edad: document.getElementById("edad").value.trim(),
      anuncios: document.getElementById("anuncios").value,
      privacidadUrl: document.getElementById("privacidad").value.trim(),
      imagen: document.getElementById("imagenUrl").value.trim(),
      apk: document.getElementById("apkUrl").value.trim(),
      size: document.getElementById("size").value.trim() || "N/A",
      packageName: document.getElementById("packageName").value.trim(),
      playstoreUrl: document.getElementById("playstoreUrl").value.trim(),
      uptodownUrl: document.getElementById("uptodownUrl").value.trim(),
      megaUrl: document.getElementById("megaUrl").value.trim(),
      mediafireUrl: document.getElementById("mediafireUrl").value.trim(),
      fecha: Date.now()
    };

    // Generar slug
    const newSlug = createSlug(nombreVal);
    
    if (editId) {
      // Si estamos editando, obtener el slug actual
      const doc = await db.collection("apps").doc(editId).get();
      if (doc.exists) {
        campos.slug = doc.data().slug || newSlug;
      } else {
        campos.slug = newSlug;
      }
    } else {
      // Si es nueva app, generar nuevo slug
      campos.slug = newSlug;
    }

    // Verificar unicidad del slug
    const slugQuery = await db.collection("apps")
      .where("slug", "==", campos.slug)
      .get();
    
    let slugIsUnique = true;
    slugQuery.forEach(doc => {
      if (doc.id !== editId) {
        slugIsUnique = false;
      }
    });
    
    // Si el slug ya existe y no es la misma app, agregar sufijo
    if (!slugIsUnique) {
      let counter = 1;
      let uniqueSlug = campos.slug;
      
      while (true) {
        const checkQuery = await db.collection("apps")
          .where("slug", "==", uniqueSlug)
          .get();
        
        let exists = false;
        checkQuery.forEach(doc => {
          if (doc.id !== editId) {
            exists = true;
          }
        });
        
        if (!exists) break;
        
        counter++;
        uniqueSlug = `${campos.slug}-${counter}`;
      }
      
      campos.slug = uniqueSlug;
    }

    // Procesar capturas
    const capturasText = document.getElementById("capturasUrl").value.trim();
    if (capturasText) {
      campos.imgSecundarias = capturasText.split(",")
        .map(u => u.trim())
        .filter(u => u !== "");
    }

    // Procesar archivos
    const imagenFile = document.getElementById("imagen").files[0];
    const apkFile = document.getElementById("apk").files[0];
    const capturasFiles = document.getElementById("capturas").files;
    
    if (imagenFile) {
      const storageRef = firebase.storage().ref();
      const imagenRef = storageRef.child("images/" + Date.now() + "_" + imagenFile.name);
      await imagenRef.put(imagenFile);
      campos.imagen = await imagenRef.getDownloadURL();
    }

    if (apkFile) {
      const storageRef = firebase.storage().ref();
      const apkRef = storageRef.child("apk/" + Date.now() + "_" + apkFile.name);
      await apkRef.put(apkFile);
      campos.apk = await apkRef.getDownloadURL();
    }

    if (capturasFiles.length > 0) {
      campos.imgSecundarias = campos.imgSecundarias || [];
      const storageRef = firebase.storage().ref();
      
      for (let i = 0; i < capturasFiles.length; i++) {
        const file = capturasFiles[i];
        const capturaRef = storageRef.child("capturas/" + Date.now() + "_" + file.name);
        await capturaRef.put(file);
        const url = await capturaRef.getDownloadURL();
        campos.imgSecundarias.push(url);
      }
    }

    // Determinar ID
    let id = editId;
    if (!id) {
      id = db.collection("apps").doc().id;
      campos.id = id;
    } else {
      campos.id = id;
    }

    // Guardar en Firestore
    await db.collection("apps").doc(id).set(campos, { merge: true });

    // Éxito - IMPORTANTE: SIEMPRE limpiar después de guardar
    estado.textContent = "✅ ¡Guardado correctamente!";
    estado.style.color = "#10b981";
    
    // LIMPIAR FORMULARIO SIEMPRE después de guardar (tanto nueva como edición)
    limpiarFormulario();
    document.getElementById("formTitle").textContent = "➕ Nueva Aplicación";
    document.getElementById("subirBtn").textContent = "SUBIR APP";
    document.getElementById("cancelarBtn").classList.add("hidden");
    editId = null; // Resetear ID de edición
    isFormModified = false; // Resetear estado de cambios

    // Recargar lista
    if (!inSearchMode) {
      loadInitialApps();
    } else {
      const currentSearch = searchInput.value.trim();
      if (currentSearch) performSearch(currentSearch);
    }

  } catch (error) {
    console.error("Error:", error);
    estado.textContent = "❌ Error: " + error.message;
    estado.style.color = "#ef4444";
  } finally {
    btn.disabled = false;
    btn.textContent = btnOriginalText;
    
    // Limpiar mensaje después de 3 segundos
    setTimeout(() => {
      estado.textContent = "";
    }, 3000);
  }
}

// =======================================================
// LIMPIAR FORMULARIO
// =======================================================
function limpiarFormulario() {
  const inputs = document.querySelectorAll("input, textarea, select");
  inputs.forEach(i => {
    if (i.type !== 'button' && i.type !== 'submit') {
      i.value = "";
    }
  });

  document.getElementById("categoria").value = "Educación";
  document.getElementById("tipo").value = "Gratis";
  document.getElementById("internet").value = "offline";
  document.getElementById("anuncios").value = "no";

  const imagenEl = document.getElementById("imagen");
  const apkEl = document.getElementById("apk");
  const capturasEl = document.getElementById("capturas");
  if (imagenEl) imagenEl.value = "";
  if (apkEl) apkEl.value = "";
  if (capturasEl) capturasEl.value = "";

  // Resetear labels
  document.getElementById("imagenLabel").textContent = "Seleccionar";
  document.getElementById("apkLabel").textContent = "Seleccionar";
  document.getElementById("capturasLabel").textContent = "Seleccionar";

  prevSize = null;
  isFormModified = false;
}

// =======================================================
// ELIMINAR APP
// =======================================================
async function eliminarApp(id) {
  if (!confirm("¿Estás seguro de eliminar esta aplicación?")) return;
  
  try {
    await db.collection("apps").doc(id).delete();
    
    // Eliminar de la vista
    const row = document.getElementById(`app-row-${id}`);
    if (row) row.remove();
    
    alert("✅ Aplicación eliminada");
    
  } catch (error) {
    console.error("Error eliminando:", error);
    alert("❌ Error al eliminar");
  }
}

// =======================================================
// CANCELAR EDICIÓN O CREACIÓN
// =======================================================
function cancelarEdicion() {
  if (editId) {
    // Modo edición
    if (confirm("¿Cancelar edición? Los cambios no guardados se perderán.")) {
      limpiarFormulario();
      document.getElementById("formTitle").textContent = "➕ Nueva Aplicación";
      document.getElementById("subirBtn").textContent = "SUBIR APP";
      document.getElementById("cancelarBtn").classList.add("hidden");
      editId = null;
      isFormModified = false;
    }
  } else {
    // Modo creación (nueva app)
    if (isFormModified) {
      if (confirm("¿Cancelar la creación de esta aplicación? Los datos ingresados se perderán.")) {
        limpiarFormulario();
        document.getElementById("cancelarBtn").classList.add("hidden");
        isFormModified = false;
      }
    } else {
      // Si no hay cambios, solo limpiar
      limpiarFormulario();
      document.getElementById("cancelarBtn").classList.add("hidden");
    }
  }
}

// =======================================================
// INICIALIZACIÓN
// =======================================================
document.addEventListener('DOMContentLoaded', () => {
  loadInitialApps();
  updateFileName('imagen', 'imagenLabel');
  updateFileName('apk', 'apkLabel');
  updateFileName('capturas', 'capturasLabel');
  setupFormChangeListeners(); // Configurar detección de cambios
});

// =======================================================
// ACTUALIZAR NOMBRE DE ARCHIVOS
// =======================================================
function updateFileName(inputId, labelId) {
  const input = document.getElementById(inputId);
  const label = document.getElementById(labelId);
  
  input.addEventListener('change', function() {
    const fileName = input.files[0] ? input.files[0].name : 'Seleccionar';
    label.textContent = fileName;
  });
}
