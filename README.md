# JS Event Loop Visualizer

Небольшой учебный проект, который помогает разбирать популярные задачки “что выведет в консоль” и понимать, **как работает event loop**:

- синхронный код (`[sync]`)
- microtasks (`Promise.then`, `queueMicrotask`) (`[micro]`)
- macrotasks / timers (`setTimeout`) (`[macro]`)

Проект запускается локально и позволяет пошагово “прокручивать” очереди.

## Быстрый старт

Требования: Node.js + npm.

```bash
npm i
npm run dev
```

## Команды

```bash
npm test
npm run lint
npm run ts:check
npm run build
npm run preview
```

## Поддерживаемый поднабор JavaScript (v1)

Симулятор исполняет код в контролируемой “песочнице” ради детерминированной визуализации, поэтому поддерживается **учебный поднабор**:

- `console.log(...)`
- `setTimeout(() => ..., delay?)` (если delay не задан — считается `0`)
- `queueMicrotask(() => ...)`
- `Promise.resolve(value).then(fn).then(...)`
- `new Promise((resolve, reject) => { ... })` + цепочки `.then(...)`

Не цель v1: полная совместимость JS (например, `async/await`, DOM, network, `import`, и т.п.).

## Пример

```js
console.log('start')

setTimeout(() => {
  console.log('setTimeout')
})

Promise.resolve().then(() => {
  console.log('resolve')
})

console.log('end')
```

Ожидаемый порядок:

1) `start`, `end` (sync)  
2) `resolve` (microtask)  
3) `setTimeout` (macrotask)
