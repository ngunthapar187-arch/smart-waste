const categories = {
  biodegradable: {
    label: "Biodegradable",
    icon: "🌱",
    guidance: "Food and garden waste can turn into compost. Put it in the food or compost bin if your area has one.",
  },
  recyclable: {
    label: "Recyclable",
    icon: "♻️",
    guidance: "Put clean paper, cans, glass and accepted bottles in recycling. Rinse containers first. Ask what your local bin takes.",
  },
  hazardous: {
    label: "Special care (hazardous)",
    icon: "⚠️",
    guidance: "This can hurt people, pets or nature. Keep it out of normal bins. Ask a grown-up to take it to a safe collection point.",
  },
  electronic: {
    label: "Electronics",
    icon: "🔌",
    guidance: "This has a battery, plug or wires. Keep it out of normal bins. Ask a grown-up to take it to an electronics drop-off point.",
  },
};

const items = [
  { name: "Banana", aliases: ["banana peel", "banana skin", "banana", "bananas"], category: "biodegradable" },
  { name: "Apple core", aliases: ["apple core"], category: "biodegradable" },
  { name: "Fruit and vegetable scraps", aliases: ["food scraps", "vegetable scraps", "vegetable peel", "potato peel", "vegetable", "vegetables", "fruit scraps", "fruit", "fruits", "carrot", "onion", "tomato", "lettuce", "potato"], category: "biodegradable" },
  { name: "Coffee grounds", aliases: ["coffee grounds", "coffee filter"], category: "biodegradable" },
  { name: "Eggshells", aliases: ["eggshell", "egg shell"], category: "biodegradable" },
  { name: "Leaves and grass clippings", aliases: ["leaves", "grass clippings", "yard waste"], category: "biodegradable" },
  { name: "Paper towel", aliases: ["paper towel", "napkin"], category: "biodegradable" },
  { name: "Plastic bottle", aliases: ["plastic bottle", "water bottle"], category: "recyclable" },
  { name: "Glass jar", aliases: ["glass jar", "glass bottle"], category: "recyclable" },
  { name: "Aluminum can", aliases: ["aluminum can", "aluminium can", "soda can", "drink can"], category: "recyclable" },
  { name: "Cardboard box", aliases: ["cardboard box", "cardboard"], category: "recyclable" },
  { name: "Paper", aliases: ["newspaper", "office paper", "paper"], category: "recyclable" },
  { name: "Steel can", aliases: ["steel can", "tin can"], category: "recyclable" },
  { name: "Battery", aliases: ["battery", "batteries", "button cell"], category: "hazardous" },
  { name: "Paint", aliases: ["paint", "paint can", "paint thinner"], category: "hazardous" },
  { name: "Cleaning chemicals", aliases: ["cleaning chemical", "bleach", "drain cleaner"], category: "hazardous" },
  { name: "Pesticide", aliases: ["pesticide", "weed killer", "insecticide"], category: "hazardous" },
  { name: "Fluorescent bulb", aliases: ["fluorescent bulb", "fluorescent tube", "cfl bulb"], category: "hazardous" },
  { name: "Thermometer", aliases: ["mercury thermometer"], category: "hazardous" },
  { name: "Mobile phone", aliases: ["mobile phone", "cell phone", "smartphone", "old phone", "phone"], category: "electronic" },
  { name: "Laptop", aliases: ["laptop", "notebook computer"], category: "electronic" },
  { name: "Charger and cables", aliases: ["phone charger", "charger", "charging cable", "usb cable"], category: "electronic" },
  { name: "Television", aliases: ["television", "tv"], category: "electronic" },
  { name: "Computer", aliases: ["computer", "desktop computer", "tablet"], category: "electronic" },
  { name: "Small appliance", aliases: ["microwave", "toaster", "electric kettle"], category: "electronic" },
];

const form = document.querySelector("#search-form");
const searchInput = document.querySelector("#item-search");
const binSelect = document.querySelector("#waste-bin");
const voiceButton = document.querySelector("#voice-button");
const hint = document.querySelector("#search-hint");
const resultSection = document.querySelector("#result-section");
const resultCard = document.querySelector("#result-card");
const clearButton = document.querySelector("#clear-result");
const categoryCards = document.querySelectorAll(".category-card");
const startCameraButton = document.querySelector("#start-camera");
const scanItemButton = document.querySelector("#scan-item");
const stopCameraButton = document.querySelector("#stop-camera");
const cameraPreview = document.querySelector("#camera-preview");
const cameraStatus = document.querySelector("#camera-status");
let lastQuery = "";
let cameraStream = null;
let objectDetector = null;
let detectorLoading = null;

const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
const recognition = SpeechRecognition ? new SpeechRecognition() : null;
let isListening = false;

if (recognition) {
  recognition.lang = navigator.language;
  recognition.interimResults = false;
  recognition.maxAlternatives = 1;
}

function normalize(text) {
  return text.toLocaleLowerCase().replace(/[^\p{L}\p{N}\s]/gu, " ").replace(/\s+/g, " ").trim();
}

function findItems(query) {
  const normalizedQuery = normalize(query);
  const paddedQuery = ` ${normalizedQuery} `;
  const matches = items
    .flatMap((item) => item.aliases.map((alias) => {
      const normalizedAlias = normalize(alias);
      const index = paddedQuery.indexOf(` ${normalizedAlias} `);
      return index < 0
        ? null
        : { item, start: index + 1, end: index + normalizedAlias.length + 1, alias: normalizedAlias };
    }))
    .filter((match) => match !== null)
    .sort((first, second) => first.start - second.start || second.alias.length - first.alias.length);
  const foundItems = [];
  let lastMatchEnd = 0;

  matches.forEach(({ item, start, end }) => {
    if (start < lastMatchEnd) {
      return;
    }

    lastMatchEnd = end;
    if (!foundItems.includes(item)) {
      foundItems.push(item);
    }
  });

  return foundItems;
}

function findItem(query) {
  return findItems(query)[0];
}

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.onload = resolve;
    script.onerror = () => {
      script.remove();
      reject(new Error(`Could not load recognition library: ${src}`));
    };
    document.head.append(script);
  });
}

async function loadObjectDetector() {
  if (objectDetector) {
    return objectDetector;
  }
  if (detectorLoading) {
    return detectorLoading;
  }

  detectorLoading = (async () => {
    if (!window.tf) {
      await loadScript("https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.22.0/dist/tf.min.js");
    }
    if (!window.cocoSsd) {
      await loadScript("https://cdn.jsdelivr.net/npm/@tensorflow-models/coco-ssd@2.2.3/dist/coco-ssd.min.js");
    }
    objectDetector = await window.cocoSsd.load();
    return objectDetector;
  })();

  try {
    return await detectorLoading;
  } finally {
    detectorLoading = null;
  }
}

function stopCamera() {
  cameraStream?.getTracks().forEach((track) => track.stop());
  cameraStream = null;
  cameraPreview.srcObject = null;
  cameraPreview.hidden = true;
  startCameraButton.disabled = false;
  scanItemButton.disabled = true;
  stopCameraButton.disabled = true;
}

function showResult(query) {
  lastQuery = query;
  const matchedItems = findItems(query);
  const item = matchedItems[0];
  const queryEntries = query.split(/[,;&+]/).map((entry) => entry.trim()).filter(Boolean);
  const hasMultipleEntries = queryEntries.length > 1;
  resultSection.hidden = false;
  categoryCards.forEach((card) => {
    card.classList.toggle("is-match", matchedItems.some((matchedItem) => card.classList.contains(matchedItem.category)));
  });

  if (!matchedItems.length) {
    resultCard.innerHTML = `
      <div class="result-icon unknown" aria-hidden="true">?</div>
      <div class="result-content">
        <h3>We couldn’t confidently identify “${escapeHtml(query)}”</h3>
        <span class="result-category">No match in our guide</span>
        ${binSelect.value ? '<div class="bin-verdict uncertain" role="status">We can’t confirm whether this is the right bin.</div>' : ""}
        <p>Try a different name, like “glass jar” or “phone charger.” Not sure? Ask a grown-up—bin rules can be different in each place.</p>
      </div>`;
    speak("Sorry, I couldn’t identify that item. Please try another name.");
    resultSection.scrollIntoView({ behavior: "smooth", block: "nearest" });
    return;
  }

  if (matchedItems.length > 1 || hasMultipleEntries) {
    const groups = Object.entries(categories)
      .map(([categoryKey, category]) => ({
        categoryKey,
        category,
        items: matchedItems.filter((matchedItem) => matchedItem.category === categoryKey),
      }))
      .filter((group) => group.items.length);
    const unrecognizedEntries = queryEntries.filter((entry) => !findItems(entry).length);
    resultCard.innerHTML = `
      <div class="result-icon mixed" aria-hidden="true">↻</div>
      <div class="result-content">
        <h3>Mixed waste identified</h3>
        <span class="result-category">${matchedItems.length} known item${matchedItems.length === 1 ? "" : "s"} sorted by destination</span>
        <p>Put each recognized item in its suggested compartment:</p>
        <div class="mixed-routes" aria-label="Suggested waste compartments">
          ${groups.map(({ categoryKey, category, items: groupItems }) => `
            <section class="mixed-route ${categoryKey}">
              <h4><span aria-hidden="true">${category.icon}</span> ${category.label}</h4>
              <ul>${groupItems.map((matchedItem) => `<li>${escapeHtml(matchedItem.name)}</li>`).join("")}</ul>
            </section>`).join("")}
        </div>
        ${unrecognizedEntries.length
          ? `<p class="mixed-warning" role="status">Not identified: ${unrecognizedEntries.map(escapeHtml).join(", ")}. Keep these aside and check local guidance.</p>`
          : ""}
        <p class="local-note">This is a sorting preview, not a physical bin. A real bin needs sensors to identify waste and motorized gates to route it. Anything not listed above has not been identified. Local sorting rules can vary.</p>
      </div>`;
    speak(`Mixed waste identified. ${groups.map(({ category, items: groupItems }) => `${groupItems.map((matchedItem) => matchedItem.name).join(", ")}: ${category.label}`).join(". ")}.`);
    resultSection.scrollIntoView({ behavior: "smooth", block: "nearest" });
    return;
  }

  const category = categories[item.category];
  const selectedBin = binSelect.value;
  const isCorrectBin = selectedBin === item.category;
  const binName = categories[selectedBin]?.label;
  const verdict = !binName
    ? ""
    : isCorrectBin
      ? `<div class="bin-verdict correct" role="status">✓ Right place — this item belongs in the ${category.label} bin.</div>`
      : `<div class="bin-verdict incorrect" role="status">✕ Not the right place — put this in the ${category.label} bin instead.</div>`;
  resultCard.innerHTML = `
    <div class="result-icon ${item.category}" aria-hidden="true">${category.icon}</div>
    <div class="result-content">
      <h3>${escapeHtml(item.name)}</h3>
      <span class="result-category">${category.label}</span>
      ${verdict}
      <p>${category.guidance}</p>
      <p class="local-note">Sorting rules can vary by location. Check your local waste guidelines for the final word.</p>
    </div>`;
  speak(`${item.name}. Goes in ${category.label}. ${category.guidance}`);
  resultSection.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

startCameraButton.addEventListener("click", async () => {
  if (!navigator.mediaDevices?.getUserMedia) {
    cameraStatus.textContent = "Camera access is unavailable. Open this page over HTTPS or localhost in a supported browser.";
    return;
  }

  startCameraButton.disabled = true;
  cameraStatus.textContent = "Starting the camera…";

  try {
    cameraStream = await navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: "environment" } });
    cameraPreview.srcObject = cameraStream;
    cameraPreview.hidden = false;
    await cameraPreview.play();
    cameraStatus.textContent = "Loading the in-browser recognition model…";
    objectDetector = await loadObjectDetector();
    scanItemButton.disabled = false;
    stopCameraButton.disabled = false;
    cameraStatus.textContent = "Camera ready. Hold one item in view and select Scan item.";
  } catch (error) {
    if (error.name === "NotAllowedError" || error.name === "PermissionDeniedError") {
      cameraStatus.textContent = "Camera permission was blocked. Allow camera access in your browser settings, then try again.";
    } else if (error.name === "NotFoundError" || error.name === "DevicesNotFoundError") {
      cameraStatus.textContent = "No camera was found. Connect a camera and try again.";
    } else {
      cameraStatus.textContent = `Could not start camera recognition: ${error.message}`;
    }
    stopCamera();
  }
});

scanItemButton.addEventListener("click", async () => {
  if (!objectDetector || !cameraStream) {
    cameraStatus.textContent = "Start the camera before scanning.";
    return;
  }

  scanItemButton.disabled = true;
  cameraStatus.textContent = "Looking for an item…";
  try {
    const detections = await objectDetector.detect(cameraPreview, 10);
    const supportedQueries = {
      banana: "banana",
      apple: "fruit scraps",
      orange: "fruit scraps",
      bottle: "plastic bottle",
      "cell phone": "mobile phone",
    };
    const match = detections
      .filter((detection) => detection.score >= 0.55 && supportedQueries[detection.class])
      .sort((first, second) => second.score - first.score)[0];

    if (!match) {
      cameraStatus.textContent = detections.length
        ? "I couldn’t confidently identify a supported waste item. Try banana, apple, orange, bottle, or cell phone, or use text search."
        : "No item detected. Hold one item clearly in view and try again.";
      return;
    }

    const query = supportedQueries[match.class];
    searchInput.value = query;
    cameraStatus.textContent = `Detected ${match.class} (${Math.round(match.score * 100)}% confidence). Check the suggested compartment below.`;
    showResult(query);
  } catch (error) {
    cameraStatus.textContent = `Could not scan the camera image: ${error.message}`;
  } finally {
    scanItemButton.disabled = false;
  }
});

stopCameraButton.addEventListener("click", () => {
  stopCamera();
  cameraStatus.textContent = "Camera stopped.";
});

window.addEventListener("pagehide", stopCamera);

function speak(message) {
  if (!("speechSynthesis" in window)) {
    return;
  }

  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(new SpeechSynthesisUtterance(message));
}

function escapeHtml(value) {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[character]);
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
  const query = searchInput.value.trim();

  if (!query) {
    hint.textContent = "Type an item name to get started.";
    searchInput.focus();
    return;
  }

  hint.textContent = "You can also tap the microphone and say another item.";
  showResult(query);
});

binSelect.addEventListener("change", () => {
  if (lastQuery && findItem(lastQuery)) {
    showResult(lastQuery);
  }
});

voiceButton.addEventListener("click", () => {
  if (!recognition) {
    hint.textContent = "Voice input isn’t supported in this browser. You can type the item name instead.";
    return;
  }

  if (isListening) {
    recognition.stop();
    hint.textContent = "Stopped listening. Tap the microphone to try again.";
    return;
  }

  try {
    recognition.start();
    isListening = true;
    voiceButton.classList.add("is-listening");
    voiceButton.setAttribute("aria-label", "Stop listening");
    hint.textContent = "Listening… say the name of the item.";
  } catch (error) {
    if (error.name === "InvalidStateError") {
      hint.textContent = "Voice input is already active. Wait for it to finish, or type the item name.";
    } else {
      throw error;
    }
  }
});

if (recognition) {
  recognition.addEventListener("result", (event) => {
    const transcript = event.results[0][0].transcript.trim();
    searchInput.value = transcript;
    hint.textContent = `Heard “${transcript}”.`;
    showResult(transcript);
  });

  recognition.addEventListener("error", (event) => {
    const messages = {
      "not-allowed": "Microphone access was blocked. Allow microphone access or type the item name.",
      "no-speech": "No speech was heard. Tap the microphone and try again.",
      "audio-capture": "No microphone was found. Connect a microphone or type the item name.",
    };
    hint.textContent = messages[event.error] || `Voice input error: ${event.error}. You can type the item name instead.`;
  });

  recognition.addEventListener("end", () => {
    isListening = false;
    voiceButton.classList.remove("is-listening");
    voiceButton.setAttribute("aria-label", "Speak an item name");
  });
}

document.querySelectorAll("[data-query]").forEach((button) => {
  button.addEventListener("click", () => {
    searchInput.value = button.dataset.query;
    hint.textContent = "You can also tap the microphone and say another item.";
    showResult(searchInput.value);
  });
});

clearButton.addEventListener("click", () => {
  resultSection.hidden = true;
  resultCard.replaceChildren();
  lastQuery = "";
  categoryCards.forEach((card) => card.classList.remove("is-match"));
  searchInput.focus();
});
