[
    {
      "examSlug": "software-engineering",
      "stageSlug": "javascript",
      "domain": "software-engineering",
      "language": "en",
      "section": "Core JavaScript",
      "topic": "Event Loop",
      "type": "output",
      "difficulty": "hard",
      "question": "What is the logging order of the following script execution?",
      "code": "console.log('1');\nsetTimeout(() => console.log('2'), 0);\nPromise.resolve().then(() => {\n  console.log('3');\n  return Promise.resolve().then(() => console.log('4'));\n}).then(() => {\n  console.log('5');\n});\nconsole.log('6');",
      "options": [
        "1, 6, 3, 2, 4, 5",
        "1, 6, 3, 4, 5, 2",
        "1, 3, 4, 5, 6, 2",
        "1, 6, 2, 3, 4, 5"
      ],
      "answer": "1, 6, 3, 4, 5, 2",
      "explanation": "Synchronous tasks (1, 6) run first. Microtasks (Promises 3, 4, 5) are processed completely before the next Macrotask (setTimeout 2) is allowed to run from the task queue.",
      "inputOutput": "N/A",
      "solutionApproach": "N/A",
      "sampleSolution": "N/A",
      "complexity": "O(1)",
      "keyConsiderations": [
        "Microtask vs Macrotask priority",
        "Nested promise resolution",
        "Call stack exhaustion"
      ]
    },
    {
      "examSlug": "software-engineering",
      "stageSlug": "javascript",
      "domain": "software-engineering",
      "language": "en",
      "section": "React Hooks",
      "topic": "useState",
      "type": "output",
      "difficulty": "medium",
      "question": "What will be the value of 'count' after a single user click?",
      "code": "function Counter() {\n  const [count, setCount] = useState(0);\n  const increment = () => {\n    setCount(count + 1);\n    setCount(count + 1);\n    setCount(count + 1);\n  };\n  return <button onClick={increment}>{count}</button>;\n}",
      "options": [
        "0",
        "1",
        "3",
        "undefined"
      ],
      "answer": "1",
      "explanation": "React batches state updates. Since each call references the 'count' value from the current closure (0), it effectively executes 'setCount(0 + 1)' three times.",
      "inputOutput": "N/A",
      "solutionApproach": "N/A",
      "sampleSolution": "N/A",
      "complexity": "O(1)",
      "keyConsiderations": [
        "Stale closures in functional components",
        "State batching in React 18",
        "Functional updates vs value updates"
      ]
    },
    {
      "examSlug": "software-engineering",
      "stageSlug": "javascript",
      "domain": "software-engineering",
      "language": "en",
      "section": "Core JavaScript",
      "topic": "Closures",
      "type": "coding",
      "difficulty": "medium",
      "question": "Implement a 'memoize' function that caches the results of a high-latency operation based on its arguments.",
      "options": [],
      "answer": "A higher-order function utilizing a Map/Object cache via closure.",
      "explanation": "Closures allow the returned function to maintain a persistent reference to a 'cache' object without polluting the global scope.",
      "inputOutput": "Input: memoize(fn); Output: function(...args)",
      "solutionApproach": "Create a cache container inside the outer function. Check if stringified args exist as a key; if so, return the value; else, execute, store, and return.",
      "sampleSolution": "function memoize(fn) {\n  const cache = {};\n  return (...args) => {\n    const key = JSON.stringify(args);\n    if (key in cache) return cache[key];\n    return cache[key] = fn(...args);\n  };\n}",
      "complexity": "Time: O(1) for lookup; Space: O(N) where N is number of unique calls.",
      "keyConsiderations": [
        "Memory management/Cache eviction",
        "Handling complex object arguments",
        "Context (this) preservation"
      ]
    },
    {
      "examSlug": "software-engineering",
      "stageSlug": "javascript",
      "domain": "software-engineering",
      "language": "en",
      "section": "Node.js",
      "topic": "Memory Management",
      "type": "scenario",
      "difficulty": "hard",
      "question": "A production Node.js service experiences a steady memory climb (leak) specifically when processing high volumes of EventEmitters. Profiling shows listeners are not being detached. How do you programmatically detect and prevent this?",
      "options": [],
      "answer": "Use process.on('warning') to catch MaxListenersExceededWarning and ensure cleanup in finally blocks.",
      "explanation": "Node.js warns at 10 listeners by default. Persistent leaks usually occur when listeners are added to long-lived objects (like 'process' or 'db-pool') within a request cycle.",
      "inputOutput": "N/A",
      "solutionApproach": "Monitor EventEmitter listener counts and utilize 'once()' or explicit removal in cleanup phases.",
      "sampleSolution": "emitter.removeListener('data', handler);",
      "complexity": "N/A",
      "keyConsiderations": [
        "WeakMap for listener tracking",
        "Garbage collection in V8",
        "Aborting async operations"
      ]
    },
    {
      "examSlug": "software-engineering",
      "stageSlug": "javascript",
      "domain": "software-engineering",
      "language": "en",
      "section": "React Advanced",
      "topic": "Reconciliation",
      "type": "mcq",
      "difficulty": "medium",
      "question": "Why is using 'Math.random()' as a key in a list considered a performance anti-pattern?",
      "options": [
        "It causes React to crash due to non-deterministic keys",
        "It forces the component to unmount and remount on every render, losing state",
        "It prevents the browser from caching the DOM nodes",
        "Math.random() is too CPU intensive for large lists"
      ],
      "answer": "It forces the component to unmount and remount on every render, losing state",
      "explanation": "During diffing, React sees a different key for the same item every time, making it think the old component is gone and a new one has arrived, destroying local state and DOM nodes.",
      "inputOutput": "N/A",
      "solutionApproach": "N/A",
      "sampleSolution": "N/A",
      "complexity": "O(N) rendering impact",
      "keyConsiderations": [
        "Identity stability",
        "Component lifecycle",
        "Virtual DOM diffing algorithm"
      ]
    },
    {
      "examSlug": "software-engineering",
      "stageSlug": "javascript",
      "domain": "software-engineering",
      "language": "en",
      "section": "Core JavaScript",
      "topic": "Concurrency",
      "type": "coding",
      "difficulty": "hard",
      "question": "Write a 'limitConcurrency' function that takes an array of async tasks and a limit 'n', ensuring no more than 'n' tasks run at any given time.",
      "options": [],
      "answer": "A function managing a task queue and an active counter using Promises.",
      "explanation": "This is critical for rate-limiting API calls or managing database connection pools in production environments.",
      "inputOutput": "Input: [task1, task2, ...], limit: 2; Output: Results array.",
      "solutionApproach": "Maintain an index and a results array. Recursively start a new task whenever one completes until the limit is reached or the array is exhausted.",
      "sampleSolution": "async function limitConcurrency(tasks, n) {\n  const results = [];\n  const executing = new Set();\n  for (const task of tasks) {\n    const p = task().then(res => { executing.delete(p); return res; });\n    results.push(p);\n    executing.add(p);\n    if (executing.size >= n) await Promise.race(executing);\n  }\n  return Promise.all(results);\n}",
      "complexity": "Time: O(T) where T is total tasks; Space: O(N) for execution tracking.",
      "keyConsiderations": [
        "Promise.race usage",
        "Error propagation in parallel tasks",
        "Resource utilization"
      ]
    },
    {
      "examSlug": "software-engineering",
      "stageSlug": "javascript",
      "domain": "software-engineering",
      "language": "en",
      "section": "Node.js",
      "topic": "Security",
      "type": "mcq",
      "difficulty": "hard",
      "question": "In a Node.js environment, how does 'Prototype Pollution' lead to a potential Remote Code Execution (RCE)?",
      "options": [
        "By overwriting the 'fs' module directly through the __proto__ property",
        "By modifying Object.prototype to inject properties used by template engines or child process spawns",
        "By filling up the Heap memory until the process crashes",
        "By intercepting network packets through the EventEmitter"
      ],
      "answer": "By modifying Object.prototype to inject properties used by template engines or child process spawns",
      "explanation": "If an attacker can inject properties like 'shell' or 'env' into Object.prototype via insecure merges, libraries that don't check hasOwnProperty will use those polluted properties to execute system commands.",
      "inputOutput": "N/A",
      "solutionApproach": "N/A",
      "sampleSolution": "N/A",
      "complexity": "N/A",
      "keyConsiderations": [
        "Insecure object merging/deep cloning",
        "Object.create(null) for safety",
        "Validation of untrusted JSON input"
      ]
    },
    {
      "examSlug": "software-engineering",
      "stageSlug": "javascript",
      "domain": "software-engineering",
      "language": "en",
      "section": "React Hooks",
      "topic": "useEffect",
      "type": "theory",
      "difficulty": "medium",
      "question": "What is the primary difference between useLayoutEffect and useEffect in terms of the browser's paint cycle?",
      "options": [],
      "answer": "useLayoutEffect runs synchronously after DOM mutations but BEFORE the browser paints; useEffect runs asynchronously AFTER the paint.",
      "explanation": "useLayoutEffect blocks the browser from painting until it finishes, which is useful for measuring DOM nodes to avoid visual flickering.",
      "inputOutput": "N/A",
      "solutionApproach": "N/A",
      "sampleSolution": "N/A",
      "complexity": "N/A",
      "keyConsiderations": [
        "Performance vs Visual stability",
        "Blocking the main thread",
        "Server-side rendering (SSR) compatibility"
      ]
    },
    {
      "examSlug": "software-engineering",
      "stageSlug": "javascript",
      "domain": "software-engineering",
      "language": "en",
      "section": "Node.js",
      "topic": "Performance",
      "type": "theory",
      "difficulty": "medium",
      "question": "Why is 'Worker Threads' preferred over 'Cluster' for a CPU-intensive task like image processing in Node.js?",
      "options": [],
      "answer": "Worker threads share memory via ArrayBuffer, allowing for efficient large data transfer compared to IPC in Cluster processes.",
      "explanation": "Clusters are essentially separate OS processes. Workers exist within the same process, reducing overhead for sharing large binary data across threads.",
      "inputOutput": "N/A",
      "solutionApproach": "N/A",
      "sampleSolution": "N/A",
      "complexity": "N/A",
      "keyConsiderations": [
        "Inter-process communication (IPC) overhead",
        "SharedArrayBuffer security (Spectre/Meltdown)",
        "Thread management overhead"
      ]
    },
    {
      "examSlug": "software-engineering",
      "stageSlug": "javascript",
      "domain": "software-engineering",
      "language": "en",
      "section": "Core JavaScript",
      "topic": "this Context",
      "type": "output",
      "difficulty": "hard",
      "question": "What is the output of the following context-heavy snippet?",
      "code": "const obj = {\n  prefix: 'Hello',\n  print: function(arr) {\n    arr.forEach(function(item) {\n      console.log(this.prefix + ' ' + item);\n    });\n  }\n};\nobj.print(['World']);",
      "options": [
        "Hello World",
        "undefined World",
        "TypeError",
        "ReferenceError"
      ],
      "answer": "undefined World",
      "explanation": "The inner function of forEach is a regular function declaration, so it loses the 'this' context of 'obj' and defaults to the global object (or undefined in strict mode).",
      "inputOutput": "N/A",
      "solutionApproach": "N/A",
      "sampleSolution": "N/A",
      "complexity": "O(1)",
      "keyConsiderations": [
        "Lexical this vs Dynamic this",
        "Arrow functions vs Function declarations",
        "forEach second argument (thisArg)"
      ]
    }
  ]

