// lib/warta/context.ts
// provide()/inject() key for the jemaat slug a warta belongs to — the one
// piece of context an otherwise self-contained block Editor (Gambar) needs
// but the registry's plain v-model contract doesn't carry. See
// components/warta/blocks/ImageBlockEditor.vue for why provide/inject
// instead of a wider prop threaded through WartaBuilder.
import type { InjectionKey, Ref } from 'vue'

export const WARTA_SLUG_KEY: InjectionKey<Ref<string>> = Symbol('warta-jemaat-slug')
