const methods = [...document.querySelectorAll('.method')]
const output = document.querySelector('#output-text')
const helpDialog = document.querySelector('#help-dialog')
const helpButton = document.querySelector('#help-button')

const currentOrigin = location.protocol === 'http:' || location.protocol === 'https:'
  ? location.origin
  : 'https://gittyper.vercel.app'

document.querySelectorAll('[data-download-origin]').forEach((element) => {
  element.textContent = currentOrigin
})

const selectMethod = (method) => {
  methods.forEach((candidate) => candidate.classList.toggle('active', candidate === method))
}

const writeClipboard = async (value) => {
  if (navigator.clipboard && window.isSecureContext) {
    await navigator.clipboard.writeText(value)
    return
  }

  const textarea = document.createElement('textarea')
  textarea.value = value
  textarea.setAttribute('readonly', '')
  textarea.style.position = 'fixed'
  textarea.style.opacity = '0'
  document.body.append(textarea)
  textarea.select()
  const copied = document.execCommand('copy')
  textarea.remove()
  if (!copied) throw new Error('Clipboard copy failed')
}

document.querySelectorAll('.command').forEach((button) => {
  button.addEventListener('focus', () => selectMethod(button.closest('.method')))
  button.addEventListener('click', async () => {
    const method = button.closest('.method')
    selectMethod(method)
    const key = button.dataset.command
    const command = key === 'curl'
      ? `curl -fsSL ${currentOrigin}/install.sh | sh`
      : key

    try {
      await writeClipboard(command)
      button.classList.add('copied')
      button.querySelector('.copy-label').textContent = 'copied'
      output.textContent = `${method.querySelector('h3').textContent} command copied. Paste it into your terminal.`
      window.setTimeout(() => {
        button.classList.remove('copied')
        button.querySelector('.copy-label').textContent = 'copy'
      }, 1800)
    } catch {
      output.textContent = 'Clipboard access was blocked. Select the command text and copy it manually.'
    }
  })
})

helpButton?.addEventListener('click', () => helpDialog?.showModal())

document.addEventListener('keydown', (event) => {
  if (event.key === '?' && helpDialog && !helpDialog.open) {
    event.preventDefault()
    helpDialog.showModal()
  }

  if (event.key === 'Escape' && output && !helpDialog?.open) {
    output.textContent = 'Select an install command to copy it.'
  }

  if (!['ArrowLeft', 'ArrowRight'].includes(event.key)) return
  const focused = document.activeElement.closest?.('.method')
  if (!focused) return
  event.preventDefault()
  const currentIndex = methods.indexOf(focused)
  const direction = event.key === 'ArrowRight' ? 1 : -1
  const nextIndex = (currentIndex + direction + methods.length) % methods.length
  methods[nextIndex].querySelector('.command').focus()
})
