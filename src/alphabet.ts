export const LETTERS = [
  ['А', 'а'], ['Б', 'бэ'], ['В', 'вэ'], ['Г', 'гэ'], ['Д', 'дэ'],
  ['Е', 'е'], ['Ё', 'ё'], ['Ж', 'жэ'], ['З', 'зэ'], ['И', 'и'],
  ['Й', 'и краткое'], ['К', 'ка'], ['Л', 'эль'], ['М', 'эм'], ['Н', 'эн'],
  ['О', 'о'], ['П', 'пэ'], ['Р', 'эр'], ['С', 'эс'], ['Т', 'тэ'],
  ['У', 'у'], ['Ф', 'эф'], ['Х', 'ха'], ['Ц', 'цэ'], ['Ч', 'че'],
  ['Ш', 'ша'], ['Щ', 'ща'], ['Ъ', 'твёрдый знак'], ['Ы', 'ы'],
  ['Ь', 'мягкий знак'], ['Э', 'э'], ['Ю', 'ю'], ['Я', 'я'],
] as const;

export const PRONUNCIATION = new Map<string, string>(LETTERS);

// Display stays uppercase; normal sentence casing helps voices avoid acronym spelling.
export function toSpokenText(text: string): string {
  return text.trim().toLocaleLowerCase('ru-RU').replace(/(^|[.!?]\s+)([а-яё])/gu,
    (_, prefix: string, letter: string) => prefix + letter.toLocaleUpperCase('ru-RU'));
}
