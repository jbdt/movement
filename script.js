document.addEventListener("DOMContentLoaded", () => {
    const apiKeyInput = document.getElementById("apiKeyInput");
    apiKeyInput.value = localStorage.getItem("apiKey") || "";
});

document.getElementById("loadCsvButton").addEventListener("click", async function () {
    const fileInput = document.getElementById("csvFile");
    const apiKeyInput = document.getElementById("apiKeyInput");
    const file = fileInput.files[0];
    const apiKey = apiKeyInput.value;

    if (!file) {
        alert("Por favor, selecciona un archivo CSV.");
        return;
    }

    if (!apiKey) {
        alert("Por favor, introduce una API Key.");
        return;
    }

    localStorage.setItem("apiKey", apiKey);

    const isApiKeyValid = await verifyApiKey(apiKey);
    if (!isApiKeyValid) {
        alert("API Key incorrecta. Por favor, introduce una API Key válida.");
        return;
    }

    const productTitles = await fetchProductTitles(apiKey);
    if (!productTitles) {
        alert("Error al obtener los títulos de productos.");
        return;
    }

    apiKeyInput.disabled = true;

    const reader = new FileReader();
    reader.onload = function (e) {
        const content = e.target.result;
        const rows = content.split("\n").slice(1);

        const table = document.createElement("table");
        const headerRow = `<tr>
            <th>Invoice date</th>
            <th>Total</th>
            <th>Payment date</th>
            <th>Name</th>
            <th>Email</th>
            <th>NIF</th>
            <th>Customer Membership</th>
            <th>Client</th>
            <th>Acciones</th>
        </tr>`;
        table.innerHTML = headerRow;

        rows.forEach(async (row) => {
            const columns = row.split(",").map(item => item.replace(/"/g, '').trim());
            if (columns.length < 6) return;

            const invoiceDate = columns[1];
            const total = columns[2];
            const paymentDate = columns[3] ? columns[3].replace("T", " ") : '';
            const name = columns[4];
            const email = columns[5];
            const nif = columns[6];
            const customerMembership = columns[7];

            const clientStatus = await checkNIF(nif, apiKey);

            const membershipStatus = productTitles.includes(customerMembership) ? "success" : "danger";

            let actionButton = '';
            let message = '';

            if (clientStatus === "Duplicado") {
                actionButton = `<button title="Revisar en Vendus" onclick="window.open('https://liquidacrobata.vendus.pt/app/clients/index/?search=${nif}&status=all', '_blank')">Revisar</button>`;
            } else if (clientStatus === "No existe") {
                actionButton = `<button title="Crear cliente" onclick="createClient('${nif}', '${name}', '${email}', '${apiKey}')">Crear</button>`;
                message = `<span id="message-${nif}"></span>`;
            }

            const newRow = `<tr>
                <td>${invoiceDate}</td>
                <td>${total}</td>
                <td>${paymentDate}</td>
                <td>${name}</td>
                <td>${email}</td>
                <td>${nif}</td>
                <td class="${membershipStatus}">${customerMembership}</td>
                <td class="${getStatusClass(clientStatus)}">${clientStatus === "Correcto" ? clientId : clientStatus}</td>
                <td>${actionButton} ${message}</td>
            </tr>`;

            table.innerHTML += newRow;
        });

        document.getElementById("tableContainer").innerHTML = "";
        document.getElementById("tableContainer").appendChild(table);
    };
    reader.readAsText(file);
});

async function verifyApiKey(apiKey) {
    try {
        const response = await fetch(`https://www.vendus.pt/ws/v1.1/account/?api_key=${apiKey}`);
        const data = await response.json();
        if (data.errors && data.errors.some(error => error.message === "AUTH")) {
            return false;
        }
        return true;
    } catch (error) {
        console.error("Error en la verificación de la API Key:", error);
        return false;
    }
}

async function fetchProductTitles(apiKey) {
    try {
        const response = await fetch(`https://www.vendus.pt/ws/v1.1/products?api_key=${apiKey}`);
        const data = await response.json();
        if (data.errors) {
            console.error("Error al obtener los productos:", data.errors);
            return null;
        }
        return data.map(product => product.title);
    } catch (error) {
        console.error("Error en la llamada a la API de productos:", error);
        return null;
    }
}

async function checkNIF(nif, apiKey) {
    if (!nif) return "No existe";
    const response = await fetch(`https://www.vendus.pt/ws/v1.1/clients?api_key=${apiKey}&fiscal_id=${nif}`);
    const data = await response.json();
    if (data.errors && data.errors.some(error => error.message === "No data")) {
        return "No existe";
    }
    if (data.length === 0) return "No existe";
    if (data.length > 1) return "Duplicado";
    return data[0].id; 
}

function getStatusClass(status) {
    if (typeof status === "number") {
        return "success";
    }
    
    switch (status) {
        case "No existe":
            return "warning";
        case "Duplicado":
            return "danger";
        default:
            return "";
    }
}

async function createClient(nif, name, email, apiKey) {
    const response = await fetch(`https://www.vendus.pt/ws/v1.1/clients?api_key=${apiKey}&fiscal_id=${nif}&name=${name}&email=${email}`, {
        method: "POST"
    });

    const messageElement = document.getElementById(`message-${nif}`);
    if (response.status === 201) {
        messageElement.innerHTML = "✅ Cliente creado";
        messageElement.style.color = "green";
    } else {
        messageElement.innerHTML = `<span style="color: red;">❌ Error al crear cliente. <a href="https://liquidacrobata.vendus.pt/app/clients/form/" target="_blank">Crear manualmente</a></span>`;
    }
}

document.getElementById("createInvoicesButton").addEventListener("click", function () {
    const tableRows = document.querySelectorAll("#tableContainer table tr");
    if (tableRows.length <= 1) {
        alert("No hay datos en la tabla.");
        return;
    }

    let allCorrect = true;
    let allMembershipSuccess = true;

    tableRows.forEach((row, index) => {
        if (index > 0) {
            const clientStatusCell = row.querySelector('td:nth-child(8)');
            const membershipCell = row.querySelector('td:nth-child(7)');

            if (clientStatusCell && (clientStatusCell.innerText === "Duplicado" || clientStatusCell.innerText === "No existe")) {
                allCorrect = false;
            }

            if (membershipCell && membershipCell.classList.contains("danger")) {
                allMembershipSuccess = false;
            }
        }
    });

    if (!allCorrect) {
        alert("Todos los clientes deben estar creados y correctos para crear facturas.");
    } else if (!allMembershipSuccess) {
        alert("Todos los Customer Membership deben ser válidos para crear facturas.");
    } else {
        alert("Hola Mundo");
    }
});

function updateFileName() {
    const fileInput = document.getElementById('csvFile');
    const fileNameDisplay = document.getElementById('fileName');

    if (fileInput.files.length > 0) {
        fileNameDisplay.textContent = fileInput.files[0].name;
    } else {
        fileNameDisplay.textContent = '';
    }
}
