// Visual preference only. Never store account or business state here.
export const appearanceKey = "aarili-appearance";
export const appearanceBootstrap = `try{document.documentElement.classList.toggle("dark",localStorage.getItem(${JSON.stringify(appearanceKey)})==="dark")}catch{}`;
