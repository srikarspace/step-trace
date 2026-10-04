async (page) => {
  const url = 'http://127.0.0.1:5197/'
  const scrollSel = '[data-steps-scroll], .table-wrap'

  await page.addInitScript(() => {
    localStorage.setItem('steptrace:v1:live', 'false')
    localStorage.setItem('steptrace:v2', JSON.stringify({ state: { live: false }, version: 0 }))
    window.__long = []
    new PerformanceObserver((list) => {
      for (const e of list.getEntries()) window.__long.push(e.duration)
    }).observe({ type: 'longtask', buffered: true })
  })

  const t0 = Date.now()
  await page.goto(url)
  await page.waitForSelector('[data-id]', { timeout: 120_000 })
  const loadMs = Date.now() - t0

  const domNodes = await page.evaluate(() => document.getElementsByTagName('*').length)
  const rowsInDom = await page.evaluate(() => document.querySelectorAll('[data-id]').length)

  const takeLong = () =>
    page.evaluate(() => {
      const xs = window.__long
      window.__long = []
      return { count: xs.length, total: Math.round(xs.reduce((a, b) => a + b, 0)), max: Math.round(Math.max(0, ...xs)) }
    })
  await takeLong()

  await page.click('#filter')
  await page.keyboard.type('bash', { delay: 60 })
  await page.waitForTimeout(500)
  const typing = await takeLong()
  await page.fill('#filter', '')
  await page.waitForTimeout(500)
  await takeLong()

  const scroll = await page.evaluate(async (sel) => {
    const el = document.querySelector(sel)
    const frames = []
    let last = performance.now()
    const start = last
    await new Promise((done) => {
      const tick = (now) => {
        frames.push(now - last)
        last = now
        el.scrollTop += 400
        if (now - start < 2000) requestAnimationFrame(tick)
        else done()
      }
      requestAnimationFrame(tick)
    })
    const sorted = [...frames].sort((a, b) => a - b)
    return {
      fps: Math.round((frames.length / (last - start)) * 1000),
      p95FrameMs: Math.round(sorted[Math.floor(sorted.length * 0.95)]),
    }
  }, scrollSel)
  await takeLong()

  await page.locator('[data-id]').first().dispatchEvent('mousedown')
  for (let i = 0; i < 30; i++) await page.keyboard.press('ArrowDown')
  await page.waitForTimeout(300)
  const arrows = await takeLong()

  return { loadMs, domNodes, rowsInDom, typing, scroll, arrows }
}
