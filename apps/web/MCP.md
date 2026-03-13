Skip to content
Navigation Menu
modelcontextprotocol
modelcontextprotocol

Type / to search
Code
Issues
65
Pull requests
28
Discussions
Actions
Projects
1
Security
Insights
Your recovery codes have not been saved in the past year. Make sure you still have them stored somewhere safe by viewing and downloading them again.


[RFC] Replace HTTP+SSE with new "Streamable HTTP" transport #206
 Merged
jspahrsummers merged 24 commits into main from justin/new-http-transport  3 weeks ago
+203 −29 
 Conversation 202
 Commits 24
 Checks 6
 Files changed 4
Conversation
jspahrsummers
Member
jspahrsummers commented last month • 
This PR introduces the Streamable HTTP transport for MCP, addressing key limitations of the current HTTP+SSE transport while maintaining its advantages.

Our deep appreciation to @atesgoral and @topherbullock (Shopify), @samuelcolvin and @Kludex (Pydantic), @calclavia, Cloudflare, LangChain, Vercel, the Anthropic team, and many others in the MCP community for their thoughts and input! This proposal was only possible thanks to the valuable feedback received in the GitHub Discussion.

TL;DR
As compared with the current HTTP+SSE transport:

We remove the /sse endpoint
All client → server messages go through the /message (or similar) endpoint
All client → server requests could be upgraded by the server to be SSE, and used to send notifications/requests
Servers can choose to establish a session ID to maintain state
Client can initiate an SSE stream with an empty GET to /message
This approach can be implemented backwards compatibly, and allows servers to be fully stateless if desired.

Motivation
Remote MCP currently works over HTTP+SSE transport which:

Does not support resumability
Requires the server to maintain a long-lived connection with high availability
Can only deliver server messages over SSE
Benefits
Stateless servers are now possible—eliminating the requirement for high availability long-lived connections
Plain HTTP implementation—MCP can be implemented in a plain HTTP server without requiring SSE
Infrastructure compatibility—it's "just HTTP," ensuring compatibility with middleware and infrastructure
Backwards compatibility—this is an incremental evolution of our current transport
Flexible upgrade path—servers can choose to use SSE for streaming responses when needed
Example use cases
Stateless server
A completely stateless server, without support for long-lived connections, can be implemented in this proposal.

For example, a server that just offers LLM tools and utilizes no other features could be implemented like so:

Always acknowledge initialization (but no need to persist any state from it)
Respond to any incoming ToolListRequest with a single JSON-RPC response
Handle any CallToolRequest by executing the tool, waiting for it to complete, then sending a single CallToolResponse as the HTTP response body
Stateless server with streaming
A server that is fully stateless and does not support long-lived connections can still take advantage of streaming in this design.

For example, to issue progress notifications during a tool call:

When the incoming POST request is a CallToolRequest, server indicates the response will be SSE
Server starts executing the tool
Server sends any number of ProgressNotifications over SSE while the tool is executing
When the tool execution completes, the server sends a CallToolResponse over SSE
Server closes the SSE stream
Stateful server
A stateful server would be implemented very similarly to today. The main difference is that the server will need to generate a session ID, and the client will need to pass that back with every request.

The server can then use the session ID for sticky routing or routing messages on a message bus—that is, a POST message can arrive at any server node in a horizontally-scaled deployment, so must be routed to the existing session using a broker like Redis.

Why not WebSocket?
The core team thoroughly discussed making WebSocket the primary remote transport (instead of SSE), and applying similar work to it to make it disconnectable and resumable. We ultimately decided not to pursue WS right now because:

Wanting to use MCP in an "RPC-like" way (e.g., a stateless MCP server that just exposes basic tools) would incur a lot of unnecessary operational and network overhead if a WebSocket is required for each call.
From a browser, there is no way to attach headers (like Authorization), and unlike SSE, third-party libraries cannot reimplement WebSocket from scratch in the browser.
Only GET requests can be transparently upgraded to WebSocket (other HTTP methods are not supported for upgrading), meaning that some kind of two-step upgrade process would be required on a POST endpoint, introducing complexity and latency.
We're also avoiding making WebSocket an additional option in the spec, because we want to limit the number of transports officially specified for MCP, to avoid a combinatorial compatibility problem between clients and servers. (Although this does not prevent community adoption of a non-standard WebSocket transport.)

The proposal in this doc does not preclude further exploration of WebSocket in future, if we conclude that SSE has not worked well.

To do
 Move session ID responsibility to server
 Define acceptable space of session IDs
 Ensure session IDs are introspectable by middleware/WAF
 Make cancellation explicit
 Require centralized SSE GET for server -> client requests and notifications
 Convert resumability into a per-stream concept
 Design a way to proactively "end session"
 "if the client has an auth token, it should include it in every MCP request"
Follow ups
Standardize support for JSON-RPC batching
Support for streaming request bodies?
Put some recommendations about timeouts into the spec, and maybe codify conventions like "issuing a progress notification should reset default timeouts."
jspahrsummers added 6 commits last month
@jspahrsummers
"Streamable HTTP" spec
ec96e58
@jspahrsummers
Remove other references to SSE
fb8e9ce
@jspahrsummers
Fix formatting
66a1cdd
@jspahrsummers
Explain resumability
39af45c
@jspahrsummers
Indicate when sessions are resumed vs. created
5474985
@jspahrsummers
Change "multiple connections" requirements
bd504c8
@jspahrsummers jspahrsummers marked this pull request as ready for review last month
@jspahrsummers jspahrsummers moved this to Consulting in Standards Track last month
@jspahrsummers jspahrsummers added this to Standards Track last month
Kludex
Kludex reviewed last month
docs/specification/draft/basic/transports.md
Outdated
docs/specification/draft/basic/transports.md
Outdated
docs/specification/draft/basic/transports.md
Outdated
the-vampiire
the-vampiire reviewed last month
docs/specification/draft/basic/transports.md
@daviddenton
daviddenton commented last month
Firstly - thanks for the effort in driving this forward 🙃

Client provides session ID in headers; server can pay attention to this if needed
This feels very unnatural and pretty insecure to me - what was the thinking about the client generating this as opposed to the server generating and signing it (possibly based on the client identity which is determined from authentication credentials)?

An alternative would be for the header to be set on the first response after the initialise request and then for the client to reuse/share it in whatever way they deem appropriate for their use-case.

the-vampiire
the-vampiire reviewed last month
docs/specification/draft/basic/transports.md
Outdated
jspahrsummers added 2 commits last month
@jspahrsummers
Rephrase "bidirectional communication"
048f812
@jspahrsummers
Endpoint *path
1917ba4
jspahrsummers
jspahrsummers commented last month
docs/specification/draft/basic/transports.md
Outdated
@jspahrsummers
GET endpoint can now return 406 Not Acceptable
e0b3493
connor4312
connor4312 reviewed last month
docs/specification/draft/basic/transports.md
Outdated
tristanz
tristanz reviewed last month
docs/specification/draft/basic/transports.md
Outdated
@dsp-ant dsp-ant self-requested a review last month
This was referenced last month
Spec compliance issues modelcontextprotocol/swift-sdk#14
Closed
Add support for "Streamble HTTP" transport modelcontextprotocol/swift-sdk#20
Open
@gunta
gunta commented last month
We're also avoiding making WebSocket an additional option in the spec

I completely agree with this decision.

While WebSocket and other transports will certainly be needed for some use cases, perhaps a separate "Extended" working group could be officially created and maintained by the community to address these needs - similar to how we could have Core and Extended working groups in the future.

@mitsuhiko
mitsuhiko commented last month
Related to the point discussed above about session IDs I think it would be reasonable to ensure that either session IDs are communicated in a way that make routing on a basic load balancer possible or a separate header is added that enables that.

(That’s for folks who do not have fancy-pantsy durable objects ;))

@c100k c100k mentioned this pull request last month
Introduce MCP Server target with a regular HTTP server c100k/libmodulor#9
Open
@ukstv
This comment was marked as off-topic.
Show comment
halter73
halter73 reviewed last month
docs/specification/draft/basic/transports.md
     `text/event-stream` as supported content types.
   - The server **MUST** either return `Content-Type: text/event-stream`, to initiate an
     SSE stream, or `Content-Type: application/json`, to return a single JSON-RPC
     _response_. The client **MUST** support both these cases.
@halter73 halter73 last month • 
Given that EventSource already does not support POST requests meaning that fetch will have to be used by browser-based clients, why not go all the way and allow more than one JSON-RPC message in POST request's streaming request body? That's certainly where my mind goes to when renaming the transport from "HTTP with SSE" to "Streamable HTTP".

While this wouldn't solve the resumability issue by itself, it would vastly simplify the transport. It would be much closer to the stdio transport, and it could potentially support binary data.

And I think it would help with the resumability issue. It greatly simplifies resumability to only have one logical stream per connection like the stdio transport does. That way, you're not stuck managing multiple last-message-ids on the server which seems like a pain.

If a core design principal is that clients should handle complexity where it exists, I'd suggest forcing the client to only have one resumable server-to-client message stream at a time.

@atesgoral atesgoral last month
JSON-RPC supports batching. You can pass an array of requests as a JSON-RPC body.

@dickhardt dickhardt last month
FWIW - in OpenID Provider Commands we are proposing a POST that returns either application/json or text/event-stream https://openid.github.io/openid-provider-commands/main.html

Member
Author
@jspahrsummers jspahrsummers last month
Supporting batched client -> server messages makes sense! I honestly had forgotten that aspect of JSON-RPC, since we ignored it for so long. 😬

I would like to extend support to streaming request bodies, but I think we should kick the can on this a bit, as it will probably involve significant discussion of its own.

Member
Author
@jspahrsummers jspahrsummers last month • 
I'll punt on batching in this PR as well, as it also affects the stdio transport and has some wider-ranging implications, but basically I agree we should support it.

@jonmumm	Reply...
@colombod
colombod commented last month
So this wouldd be bringing httptreansport and quic protocol to the mix?

@canncupiscent
This comment was marked as spam.
Show comment
halter73
halter73 reviewed last month
docs/specification/draft/basic/transports.md
99 hidden items
Load more…
@andylouisqin andylouisqin mentioned this pull request 3 weeks ago
Support for installing servers in VS Code opentoolsteam/cli#7
Closed
@ahmadawais
Contributor
ahmadawais commented 2 weeks ago • 
Super excited to see this through.

P.S. @jirispilka The schema.ts link in the release notes is broken.

Sending in a PR #248

@painpita painpita mentioned this pull request 2 weeks ago
Support HTTP streaming transport modelcontextprotocol/inspector#221
Open
@pmohan6 pmohan6 mentioned this pull request 2 weeks ago
Passing authorization header to an MCP server over websockets lastmile-ai/mcp-agent#79
Open
@hemanth
hemanth commented 2 weeks ago
Came here looking for this! Awaiting the SDKs to enable Streamable HTTP 🤓

@daviddenton
daviddenton commented 2 weeks ago
Came here looking for this! Awaiting the SDKs to enable Streamable HTTP 🤓

Am sure the official ones will be along soon, but If you're working with the JVM, you might find the http4k SDK useful - it offers a functional approach with strong testing capabilities. 😉

@wtberry wtberry mentioned this pull request 2 weeks ago
Enable MCP integration dapr/dapr-agents#50
Closed
@mikekistler mikekistler mentioned this pull request 2 weeks ago
[2025-03-26 spec] Implement the Streamable HTTP transport modelcontextprotocol/csharp-sdk#157
Open
1 task
@CaliViking
CaliViking commented 2 weeks ago • 
It’s hard to fully follow these threads, but the new proposal still uses HTTP and SSE—just in a revised structure.

The arguments in the “Why not WebSocket?” section seem weak. The first three technical points are factually incorrect or misleading. Basing architecture on protocol misunderstandings risks designing the wrong solution.
❌ “RPC-like use of WebSocket adds overhead” – Actually, WebSocket reduces overhead in high-frequency RPC-like interactions by keeping a persistent connection.
❌ “Can’t attach headers in browser WebSockets” – True, but there are standard workarounds (e.g., query params, subprotocols, cookies).
❌ “Only GET supports upgrade” – Technically true, but irrelevant. WebSocket upgrades over GET are well-supported and not a real-world issue.

Choose the right transport for the job:
1️⃣ HTTP = request-response
2️⃣ SSE = one-way server push
3️⃣ WebSocket = two-way full-duplex
Align transport choices with actual communication needs—especially if MCP aims to support diverse interaction patterns.

@QuantGeekDev
QuantGeekDev commented 2 weeks ago
@CaliViking I've been thinking about this a lot lately. It does give that impression at times. Maybe we could have a much more constructive conversation all together, it would be useful if someone implemented WS (or the one in sdk) alongside the new http specification, and performs extensive stress testing on it in an environment that approximates production. We should have real data and numbers to be able to argument what the overhead would be, and what tradeoffs that would imply

This was referenced 2 weeks ago
MOT Python SDK openwallet-foundation-labs/tsp#94
Open
MOT with TS SDK openwallet-foundation-labs/tsp#104
Open
@kentcdodds kentcdodds mentioned this pull request 2 weeks ago
Exploring Streaming? geelen/mcp-remote#14
Open
@ChrisLally
ChrisLally commented last week
Shipped https://inspect.mcp.garden for anyone interested in trying out HTTP+SSE (or just SSE) without needing to run the MCP Inspector locally!

Screenshot 2025-04-04 at 5 12 41 PM

@Zhaobudaoyuema Zhaobudaoyuema mentioned this pull request last week
请问一下是怎么支持的当前最新的Streamable HTTP模式？ alibaba/higress#2001
Open
@junjiem junjiem mentioned this pull request last week
大佬，捉个虫，你在dify上面发布的agent策略里好像sse写错成see了，你看下是不是呢 junjiem/dify-plugin-agent-mcp_sse#17
Closed
@rajivml rajivml mentioned this pull request last week
Support HTTP streaming transport supercorp-ai/supergateway#38
Open
jspahrsummers pushed a commit that referenced this pull request last week
@tadasant
Merge pull request #206 from modelcontextprotocol/ashwin/claudecode …
5e99650
@apryiomka
apryiomka commented last week • 
HTTP = request-response

we need #1 for agent base turn pattern. Does the SDK have any pre-release version that we can try?

@apryiomka apryiomka mentioned this pull request last week
Implement Streamable HTTP transport modelcontextprotocol/python-sdk#443
Open
@QuantGeekDev
QuantGeekDev commented last week • 
Shipped https://inspect.mcp.garden for anyone interested in trying out HTTP+SSE (or just SSE) without needing to run the MCP Inspector locally!

Screenshot 2025-04-04 at 5 12 41 PM

Glad you were able to deploy mcp-debug :) super cool to see my fork in the wild. did you like the stats page? i'm thinking of creating a PR for that to the inspector. good luck with the mcp garden project🚀

@longfin longfin mentioned this pull request last week
[Feature] Support Streamable HTTP planetarium/mcp-agent8#4
Open
@apryiomka
apryiomka commented last week
Shipped https://inspect.mcp.garden for anyone interested in trying out HTTP+SSE (or just SSE) without needing to run the MCP Inspector locally!

Screenshot 2025-04-04 at 5 12 41 PM

this is not in main, what branch are you running?

@apryiomka
apryiomka commented last week
Does anyone have a Python SDK version for the server and client for the new HTTP protocol?

@localden localden mentioned this pull request 5 days ago
[RFC] Update the Authorization specification for MCP servers #284
 Open
4 tasks
@kajirita2002 kajirita2002 mentioned this pull request 4 days ago
Bug: McpAgent forces internal WebSocket upgrade for SSE connections cloudflare/agents#172
Open
This was referenced 2 days ago
Feature/robust sse transport sooperset/mcp-atlassian#224
 Open
Feature: Accept Config Variables via Request Headers and Query Parameters (Multi-User) sooperset/mcp-atlassian#239
 Open
@raphaelkieling raphaelkieling mentioned this pull request 2 days ago
Add support for Streamable HTTP rekog-labs/MCP-Nest#25
Open
@ttimasdf ttimasdf mentioned this pull request 11 hours ago
Deprecate HTTP-SSE server transport MCPPhalanx/binaryninja-mcp#12
Open
Merge info
Pull request successfully merged and closed
You're all set — the branch has been merged.

@jonmumm


Add a comment
Comment
 
Add your comment here...
 
Remember, contributions to this repository should follow its contributing guidelines, security policy, and code of conduct.
 ProTip! Add .patch or .diff to the end of URLs for Git’s plaintext views.
Reviewers
@topherbullock
topherbullock
@He-Pin
He-Pin
@halter73
halter73
@nfcampos
nfcampos
@mitsuhiko
mitsuhiko
@yuval-k
yuval-k
@JosephMoniz
JosephMoniz
@connor4312
connor4312
@dickhardt
dickhardt
@CaliViking
CaliViking
@maceip
maceip
@Padarn
Padarn
@vromero
vromero
@marianogonzalez
marianogonzalez
@juharris
juharris
@daviddenton
daviddenton
@tristanz
tristanz
@atesgoral
atesgoral
@chrisclark
chrisclark
@tao12345666333
tao12345666333
@samuelcolvin
samuelcolvin
@hamidra
hamidra
@johnlanni
johnlanni
@Kludex
Kludex
@samdenty
samdenty
@nagl-temporal
nagl-temporal
@Halooooooo
Halooooooo
@the-vampiire
the-vampiire
@jwebb49
jwebb49
@localden
localden
@tekorex
tekorex
@bhosmer-ant
bhosmer-ant
@dsp-ant
dsp-ant
@jerome3o-anthropic
jerome3o-anthropic
Assignees
No one assigned
Labels
None yet
Projects
 Standards Track

Status: Approved
Milestone
No milestone
Development
Successfully merging this pull request may close these issues.

None yet

Loading
58 participants
@jspahrsummers
@daviddenton
@gunta
@mitsuhiko
@ukstv
@colombod
@canncupiscent
@calclavia
@DoiiarX
@tao12345666333
@He-Pin
@SecretiveShell
@dickhardt
@evalstate
@xring
@QuantGeekDev
@terry-xiaoyu
@d46
@rofrol
@hamidra
@ChrisLally
@kanlanc
@4t145
@liudonghua123
@shouldnotappearcalm
@jirispilka
@ahmadawais
@hemanth
@CaliViking
@apryiomka
@atesgoral
@halter73
@nfcampos
@tristanz
@yuval-k
@JosephMoniz
@chrisclark
@maceip
@Padarn
@vromero
@marianogonzalez
@juharris
@topherbullock
@connor4312
@samuelcolvin
@johnlanni
@Kludex
@samdenty
@nagl-temporal
@Halooooooo
@the-vampiire
@jwebb49
@botengyao
@localden
@jerome3o-anthropic
@dsp-ant
@bhosmer-ant
@tekorex
Footer
© 2025 GitHub, Inc.
Footer navigation
Terms
Privacy
Security
Status
Docs
Contact
Manage cookies
Do not share my personal information
[RFC] Replace HTTP+SSE with new "Streamable HTTP" transport by jspahrsummers · Pull Request #206 · modelcontextprotocol/modelcontextprotocol