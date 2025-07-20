import neo4j from 'neo4j-driver';
import { Chat, writeTerminalStream } from './chat-stream/lib'
import fs from 'fs'

const URI = 'neo4j://localhost:7687';
const USER = 'neo4j';
const PASSWORD = 'password123';

const apiKey = process.env.OPENROUTER_API_KEY || ''
if (!apiKey) { console.error('OPENROUTER_API_KEY environment variable not set'); process.exit(1) }

async function main(): Promise<[void, Error | null]> {
  const driver = neo4j.driver(URI, neo4j.auth.basic(USER, PASSWORD));
  const chat = new Chat(apiKey)
  chat.model = 'openai/gpt-4o-mini'
  chat.customArgs.name = 'Gabriel'
  chat.systemPromptTemplate = fs.readFileSync('./personas/gabriel.txt', 'utf8') + '\n' +
  "Aim to be concise but not so much that your responses are too short. A happy medium. (Max one linebreak)"
  try {
    await driver.getServerInfo();
    console.log('✅ Connected to Neo4j successfully!');
    
    const readline = await import('readline')
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, prompt: 'You: ' })
    rl.prompt()
    rl.on('line', async (line: string) => {
      if (line.trim().toLowerCase() === 'exit') { rl.close(); return }
      try {
        const [content, err] = await writeTerminalStream(chat.sendMessage(line.trim()), {prefix: 'AI: '})
        if (err) console.error('Error:', err)
      } catch (error) { console.error('Error:', error) }
      rl.prompt()
    })
    rl.on('close', () => process.exit(0))

    return [undefined, null];
  } catch (error) {
    return [undefined, error as Error];
  } finally {
    await driver.close();
  }
}

main().then(([, err]) => {
  if (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  }
});