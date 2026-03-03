I Want to take a different approach to local image AI generation,
and ease away from just text to image, but create a multi-layer image composer tool.

I want to create a Javascript React app with Python API layer and ML backend.

The workflow looks like this:

1. Create the overarching prompt, explaining what you want. This is the unifier that will be
   referred to and refined in the rest of the process.
2. Begin blocking at the first image layer. This layer can block out large
   objects like terrain, buildings, and background points.
3. Lay out Object layers - specific things that will be generated sepearte,
   like people, and specific objects. You can quickly describe what the person/thing is and get
   a blocking sketch wireframe that you can reposition, and give directions like -
   rotate horizontally, with tools and individual chat interface.
   This should communicate with a light-weight wireframe sketch model that is fast and builds
   just the general outline. You can build several layers of wireframes that are independent
   of another, but refer to the overarching prompt, and when there is a conflict,
   it asks for clarification. You can then generate placed objects.

While this is being built up, a context relation is being built into the data layer.
For example you create a person object. The person faces a picture object,
the mapping builds a relation so generation can be guided by specific context.
You can refine and regenerate sketches as you move them. When all sketches are
generated and in place, the overall generator breaks the finalized image map
up into zones and generates the image in groupings of relations.

So I will need a UI layer, a UI control layer, A ML API layer, a Data API layer,
a database for data mappings, and a relational database for objects I think.

Help me lay out the basic architecture and breakdown so I can put this information
into codex to begin coding it. Break down phase 0 structuring,

MVP, and consecutive phases to get a viable product

---

Current milestone snapshot (2026-03-03):

- Release 0 (MVP): complete and signed off.
- Release 0 sign-off artifact: `docs/RELEASE_0_SIGNOFF.MD`.
- Next milestone: Release 1 (Production Ready) with security hardening first
  (auth, RBAC, rate limiting, compliance logging, secrets/dependency hardening).
