import { GOOGLE_SCRIPT_URL } from '../constants';

export const api = {
    get: async (key: string) => {
        if ((GOOGLE_SCRIPT_URL as string) === "PASTE_URL_APPS_SCRIPT_DISINI") {
            console.warn("URL Script belum diset");
            return null;
        }
        try {
            const response = await fetch(`${GOOGLE_SCRIPT_URL}?action=read&key=${key}`);
            const result = await response.json();
            if (result.status === 'success') {
                return result.data;
            }
            return null;
        } catch (e) {
            console.error("Fetch Error:", e);
            return null;
        }
    },
    post: async (key: string, value: any) => {
        if ((GOOGLE_SCRIPT_URL as string) === "PASTE_URL_APPS_SCRIPT_DISINI") {
            alert("Harap konfigurasi URL Google Script terlebih dahulu!");
            return false;
        }
        try {
            const response = await fetch(GOOGLE_SCRIPT_URL, {
                method: 'POST',
                body: JSON.stringify({ action: "write", key, value })
            });
            const result = await response.json();
            return result.status === 'success';
        } catch (e) {
            console.error("Post Error:", e);
            return false;
        }
    }
};