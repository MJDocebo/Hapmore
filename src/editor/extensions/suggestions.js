import { Extension, InputRule } from '@tiptap/core';
import { PluginKey } from '@tiptap/pm/state';
import Suggestion from '@tiptap/suggestion';
import { createSuggestionRenderer } from '../suggestionRenderer';
import { filterBlocks } from '../blocks';
import BlockMenuList from '../components/BlockMenuList';
import EmojiList from '../components/EmojiList';
import { searchEmojis, getNativeEmoji } from '../../lib/emojiData';
import { useApp } from '../../store/useApp';

const notInCode = ({ editor }) => !editor.isActive('codeBlock') && !editor.isActive('code');

/** "\" + letters → filtered block menu. A lone "\" followed by a space (or Escape) stays as a normal character. */
export const SlashCommand = Extension.create({
  name: 'slashCommand',
  addProseMirrorPlugins() {
    return [
      Suggestion({
        editor: this.editor,
        pluginKey: new PluginKey('hmSlashCommand'),
        char: '\\',
        allowSpaces: false,
        startOfLine: false,
        allow: notInCode,
        items: ({ query }) => filterBlocks(query),
        command: ({ editor, range, props }) => props.run(editor, range),
        render: createSuggestionRenderer(BlockMenuList),
      }),
    ];
  },
});

function customList() {
  return useApp.getState().emojis.map((e) => ({ id: e.id, name: e.name, url: e.url }));
}

/** ":" + 2 letters → emoji autocomplete; typing a full ":name:" converts automatically. */
export const EmojiSuggest = Extension.create({
  name: 'emojiSuggest',

  addInputRules() {
    return [
      new InputRule({
        find: /(?<![\w:]):([a-z0-9_+-]{2,40}):$/,
        handler: ({ state, range, match }) => {
          const name = match[1].toLowerCase();
          const custom = useApp.getState().emojis.find((e) => e.name === name);
          const { tr } = state;
          if (custom) {
            tr.replaceWith(range.from, range.to, state.schema.nodes.customEmoji.create({ id: custom.id, name: custom.name }));
            return undefined;
          }
          const native = getNativeEmoji(name);
          if (!native) return null;
          tr.insertText(native, range.from, range.to);
          return undefined;
        },
      }),
    ];
  },

  addProseMirrorPlugins() {
    return [
      Suggestion({
        editor: this.editor,
        pluginKey: new PluginKey('hmEmojiSuggest'),
        char: ':',
        allowSpaces: false,
        allow: notInCode,
        items: ({ query }) => (query.length < 2 ? [] : searchEmojis(query, customList(), 10)),
        command: ({ editor, range, props }) => {
          if (props.kind === 'custom') {
            editor.chain().focus().insertContentAt(range, { type: 'customEmoji', attrs: { id: props.id, name: props.name } }).run();
          } else {
            editor.chain().focus().insertContentAt(range, props.native).run();
          }
        },
        render: createSuggestionRenderer(EmojiList),
      }),
    ];
  },
});
