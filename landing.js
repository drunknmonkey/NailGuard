import { applyStaticTranslations, getLocale, setLocale, t } from "./i18n.js";

const els = {
  langButtons: [...document.querySelectorAll(".lang-option")],
  form: document.querySelector("#waitlistForm"),
  email: document.querySelector("#waitlistEmail"),
  submit: document.querySelector("#waitlistSubmit"),
  status: document.querySelector("#waitlistStatus"),
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

init();

function init() {
  applyLocale(getLocale());

  for (const button of els.langButtons) {
    button.addEventListener("click", () => {
      setLocale(button.dataset.locale);
      applyLocale(button.dataset.locale);
    });
  }

  els.form.addEventListener("submit", submitWaitlist);
}

function applyLocale(locale) {
  document.documentElement.lang = locale;
  document.title = t("landing.title");
  applyStaticTranslations();

  for (const button of els.langButtons) {
    button.classList.toggle("active", button.dataset.locale === getLocale());
  }

  if (els.status.dataset.key) {
    els.status.textContent = t(els.status.dataset.key);
  }
}

async function submitWaitlist(event) {
  event.preventDefault();

  const email = els.email.value.trim().toLowerCase();
  if (!EMAIL_PATTERN.test(email)) {
    setStatus("landing.invalid");
    return;
  }

  els.submit.disabled = true;
  setStatus("");

  try {
    const response = await fetch("./api/waitlist", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, locale: getLocale() }),
    });

    if (response.ok) {
      setStatus("landing.success");
      els.form.reset();
    } else if (response.status === 400) {
      setStatus("landing.invalid");
    } else if ([501, 503, 404, 405].includes(response.status)) {
      setStatus("landing.notConfigured");
    } else {
      setStatus("landing.error");
    }
  } catch {
    setStatus("landing.error");
  } finally {
    els.submit.disabled = false;
  }
}

function setStatus(key) {
  els.status.dataset.key = key;
  els.status.textContent = key ? t(key) : "";
}
