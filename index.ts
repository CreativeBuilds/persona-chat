import { Chat, Persona, PersonaRegistry, CommandParser, writeTerminalStream } from './chat-stream/lib'
import { EchoAgent } from './chat-stream/lib/echo-agent'
import { getExistingPersonaNames, savePersona, parsePersonaJSON } from './chat-stream/lib/persona-utils'
import fs from 'fs'
import path from 'path'

const apiKey = process.env.OPENROUTER_API_KEY || ''
if (!apiKey) { console.error('OPENROUTER_API_KEY environment variable not set'); process.exit(1) }

async function main(): Promise<[void, Error | null]> {
  // Load all personas from JSON files
  const personasPath = path.join(process.cwd(), 'personas')
  const registry = new PersonaRegistry()
  const chat = new Chat()
  chat.personaMap = {}

  // Load all valid persona files
  const loadedPersonas: string[] = []
  const failedPersonas: string[] = []

  if (fs.existsSync(personasPath)) {
    const files = fs.readdirSync(personasPath)
    for (const file of files) {
      if (!file.endsWith('.json')) continue

      try {
        const filePath = path.join(personasPath, file)
        const data = JSON.parse(fs.readFileSync(filePath, 'utf8'))
        const persona = Persona.importJSON(data, apiKey)

        if (persona.customArgs?.name) {
          registry.register(persona.customArgs.name, persona)
          chat.personaMap[persona.id] = persona
          loadedPersonas.push(persona.customArgs.name)
        } else {
          failedPersonas.push(file)
        }
      } catch (error) {
        failedPersonas.push(file)
        console.warn(`⚠️  Failed to load persona from ${file}: ${error instanceof Error ? error.message : 'Unknown error'}`)
      }
    }
  }

  if (loadedPersonas.length > 0) {
    console.log(`✅ Loaded ${loadedPersonas.length} persona(s): ${loadedPersonas.join(', ')}`)
  }

  if (failedPersonas.length > 0) {
    console.log(`⚠️  Skipped ${failedPersonas.length} invalid persona file(s): ${failedPersonas.join(', ')}`)
  }

  // Initialize echo agent for persona creation
  const existingPersonaNames = getExistingPersonaNames(personasPath)
  const echoAgent = new EchoAgent(apiKey, existingPersonaNames)

  try {
    console.log('Commands:')
    console.log('  @gabriel - Switch to Gabriel (fuzzy search)')
    console.log('  /debug   - Show conversation history')
    console.log('  /help    - Show this help')
    console.log('  /list    - List all personas')
    console.log('  /create  - Create a new persona')
    console.log('  /edit    - Edit an existing persona')

    const readline = await import('readline')
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, prompt: 'You: ' })
    rl.prompt()
    rl.on('line', async (line: string) => {
      if (CommandParser.isExitCommand(line)) { rl.close(); return }

      const parsed = CommandParser.parse(line)

      // Add spacing after user input for better readability
      if (parsed.message && !parsed.command) {
        console.log()
      }

      if (parsed.command === 'switch' && parsed.targetPersona) {
        const persona = registry.switchTo(parsed.targetPersona)
        if (!persona) {
          console.log(`Unknown persona: ${parsed.targetPersona}`)
          const suggestions = registry.findSuggestions(parsed.targetPersona)
          if (suggestions.length > 0) {
            console.log(`Did you mean: ${suggestions.join(', ')}?`)
          } else {
            console.log(`Available: ${registry.getAllDisplayNames().join(', ')}`)
          }
          rl.prompt()
          return
        }
        console.log(`Switched to ${persona.customArgs.name}`)
        if (!parsed.message) { rl.prompt(); return }
      }

      if (parsed.command === 'debug') {
        const current = registry.getCurrent()
        if (current) console.log(chat.formatMessagesForPersona(current))
        rl.prompt()
        return
      }

      if (parsed.command === 'help') {
        console.log('Commands:')
        console.log('  @gabriel - Switch to Gabriel (fuzzy search)')
        console.log('  /debug   - Show conversation history')
        console.log('  /help    - Show this help')
        console.log('  /list    - List all personas')
        console.log('  /create  - Create a new persona')
        console.log('  /edit    - Edit an existing persona')
        rl.prompt()
        return
      }

      if (parsed.command === 'list') {
        console.log('Available personas:', registry.getAllDisplayNames().join(', '))
        rl.prompt()
        return
      }

      if (parsed.command === 'create') {
        if (echoAgent.isCreating() || echoAgent.isEditing()) {
          console.log('Already in creation or edit mode. Continue chatting or type "create"/"save" to finalize.')
          rl.prompt()
          return
        }

        if (!parsed.message) {
          console.log('Please provide a description of the persona you want to create.')
          console.log('Example: /create A wise mentor who gives practical advice')
          rl.prompt()
          return
        }

        try {
          const [content, err] = await writeTerminalStream(echoAgent.startCreationProcess(parsed.message), {prefix: 'Echo: '})
          if (err) console.error('Error:', err)
        } catch (error) { console.error('Error:', error) }
        rl.prompt()
        return
      }

      if (parsed.command === 'edit') {
        if (echoAgent.isCreating() || echoAgent.isEditing()) {
          console.log('Already in creation or edit mode. Continue chatting or type "create"/"save" to finalize.')
          rl.prompt()
          return
        }

        if (!parsed.message) {
          console.log('Please provide the persona name and what you want to edit.')
          console.log('Example: /edit gabriel make them more friendly and approachable')
          rl.prompt()
          return
        }

        // Parse persona name from message
        const words = parsed.message.split(' ')
        const personaName = words[0].toLowerCase()
        const editRequest = words.slice(1).join(' ')

        if (!editRequest) {
          console.log('Please provide what you want to edit about the persona.')
          console.log('Example: /edit gabriel make them more friendly and approachable')
          rl.prompt()
          return
        }

        // Find the persona to edit
        const personaToEdit = registry.get(personaName)
        if (!personaToEdit) {
          console.log(`Unknown persona: ${personaName}`)
          const suggestions = registry.findSuggestions(personaName)
          if (suggestions.length > 0) {
            console.log(`Did you mean: ${suggestions.join(', ')}?`)
          } else {
            console.log(`Available: ${registry.getAllDisplayNames().join(', ')}`)
          }
          rl.prompt()
          return
        }

        try {
          const [content, err] = await writeTerminalStream(echoAgent.startEditProcess(personaToEdit, editRequest), {prefix: 'Echo: '})
          if (err) console.error('Error:', err)
        } catch (error) { console.error('Error:', error) }
        rl.prompt()
        return
      }

      if (parsed.command === 'unknown') {
        console.log('Unknown command. Type /help for available commands.')
        rl.prompt()
        return
      }

      // Check if we're in echo agent creation or edit mode
      if (echoAgent.isCreating()) {
        try {
          const [content, err] = await writeTerminalStream(echoAgent.continueConversation(parsed.message), {prefix: 'Echo: '})
          if (err) console.error('Error:', err)

          // Check if the response contains JSON (finalization)
          if (content && content.includes('{') && content.includes('}')) {
            const [personaData, parseErr] = parsePersonaJSON(content)
            if (!parseErr && personaData) {
              const [filepath, saveErr] = savePersona(personaData, personasPath)
              if (!saveErr) {
                console.log(`✅ Persona "${personaData.customArgs.name}" created successfully!`)
                console.log(`📁 Saved to: ${filepath}`)

                // Load and register the new persona
                const newPersona = Persona.importJSON(personaData, apiKey)
                registry.register(personaData.customArgs.name, newPersona)
                chat.personaMap[newPersona.id] = newPersona

                echoAgent.reset()
              } else {
                console.error('❌ Failed to save persona:', saveErr.message)
              }
            } else {
              console.error('❌ Failed to parse persona JSON:', parseErr?.message)
            }
          }
        } catch (error) { console.error('Error:', error) }
        rl.prompt()
        return
      }

      if (echoAgent.isEditing()) {
        try {
          const [content, err] = await writeTerminalStream(echoAgent.continueEditConversation(parsed.message), {prefix: 'Echo: '})
          if (err) console.error('Error:', err)

          // Check if the response contains JSON (finalization)
          if (content && content.includes('{') && content.includes('}')) {
            const [personaData, parseErr] = parsePersonaJSON(content)
            if (!parseErr && personaData) {
              const [filepath, saveErr] = savePersona(personaData, personasPath)
              if (!saveErr) {
                console.log(`✅ Persona "${personaData.customArgs.name}" updated successfully!`)
                console.log(`📁 Saved to: ${filepath}`)

                // Update the persona in registry and chat
                const updatedPersona = Persona.importJSON(personaData, apiKey)
                registry.register(personaData.customArgs.name, updatedPersona)
                chat.personaMap[updatedPersona.id] = updatedPersona

                echoAgent.reset()
              } else {
                console.error('❌ Failed to save persona:', saveErr.message)
              }
            } else {
              console.error('❌ Failed to parse persona JSON:', parseErr?.message)
            }
          }
        } catch (error) { console.error('Error:', error) }
        rl.prompt()
        return
      }

      const targetPersona = registry.getCurrent() || (registry.getAllNames().length > 0 ? registry.get(registry.getAllNames()[0]) : null)
      if (!targetPersona) {
        console.log('❌ No personas available. Please create a persona first using /create')
        rl.prompt()
        return
      }

      try {
        const [content, err] = await writeTerminalStream(chat.sendMessage(parsed.message, targetPersona), {prefix: `${targetPersona.customArgs.name}: `})
        chat.messages.push({role: 'assistant', content: content, persona_id: targetPersona.id})
        if (err) console.error('Error:', err)
        console.log() // Add spacing after persona response
      } catch (error) { console.error('Error:', error) }
      rl.prompt()
    })
    rl.on('close', () => process.exit(0))

    return [undefined, null];
  } catch (error) {
    return [undefined, error as Error];
  }
}

main().then(([, err]) => {
  if (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  }
});