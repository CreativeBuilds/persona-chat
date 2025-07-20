# Neo4j Examples

This directory contains examples for working with Neo4j using Docker.

## Setup

1. **Start Neo4j with Docker:**
   ```bash
   npm run docker:up
   ```
   This will start Neo4j on:
   - Browser UI: http://localhost:7474
   - Bolt Protocol: neo4j://localhost:7687
   - Username: `neo4j`
   - Password: `password123`

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Run the example:**
   ```bash
   npm run start
   ```

## Available Scripts

- `npm run docker:up` - Start Neo4j container
- `npm run docker:down` - Stop Neo4j container  
- `npm run docker:logs` - View Neo4j logs
- `npm run start` - Run the example once
- `npm run dev` - Run with file watching

## Neo4j Browser

Access the Neo4j Browser at http://localhost:7474

Login with:
- Username: `neo4j`
- Password: `password123`

## Example Queries

Try these queries in the Neo4j Browser:

```cypher
// View all nodes and relationships
MATCH (n)-[r]->(m) RETURN n, r, m

// Find all people
MATCH (p:Person) RETURN p

// Find friends of Alice
MATCH (alice:Person {name: 'Alice'})-[:FRIENDS_WITH]->(friend)
RETURN friend.name as friend
```

## Docker Management

The setup uses Docker volumes for persistence. To completely reset:

```bash
npm run docker:down
docker volume prune
npm run docker:up
``` 