# Frontend MVP Plan

This backlog delivers the user interface first with mock data, followed by
Supabase product integration, anonymous cart state, AI integration, and MVP
validation.

## Estimation

- 1 point = 1 working day
- 2 points = 2 working days
- 3 points = 3 working days

## Phase 1: Frontend UI

### FE-01: Design system, global layout, and navbar

**Estimate:** 3 points

Includes:

- Colours, typography, spacing, and breakpoints
- Shared page container
- Desktop and mobile navbar
- Cart count indicator
- Base buttons and form controls
- Route shells for `/`, `/products/[productId]`, and `/cart`

Acceptance criteria:

- Shared styling is consistent across all pages.
- The navbar works on mobile and desktop.
- Each route renders independently with placeholder content.

### FE-02: Product cards, listing grid, and feedback states

**Estimate:** 3 points

Includes:

- Standard product card
- Compact recommendation card
- Responsive product grid
- Skeleton and loading states
- Error, retry, empty, and missing-image states

Acceptance criteria:

- Components render correctly using mock data.
- Cards support unavailable products.
- The grid works from mobile through desktop.

### FE-03: Landing page and product discovery UI

**Estimate:** 3 points 

**Depends on:** FE-01, FE-02

Includes:

- Hero section
- Product listing
- Category, gender, colour, size, and price filters
- Sorting and result count
- Pagination or load-more interface
- Responsive layout

Acceptance criteria:

- Users can filter and sort mock products.
- Filters can be cleared.
- Empty results display an appropriate state.

### FE-04: Complete chatbot interface

**Estimate:** 3 points

**Depends on:** FE-01, FE-02

Includes:

- Chatbot panel
- User and assistant messages
- Typing and error messages
- Input box and send button
- Recommendation cards inside chat
- Desktop panel and mobile full-screen experience

Acceptance criteria:

- Mock conversations work without an AI connection.
- Enter sends and Shift+Enter creates a new line.
- The interface is keyboard accessible and responsive.

### FE-05: Complete product details page UI

**Estimate:** 3 points

**Depends on:** FE-01, FE-02

Includes:

- Image gallery
- Product information and attributes
- Price, catalogue attributes, and description
- Size and stock selector
- Quantity selector
- Add-to-cart feedback
- Related recommendations section
- Responsive layout

Acceptance criteria:

- The page works with mock product data.
- Unavailable sizes cannot be selected.
- Missing optional data does not break the layout.

### FE-06: Complete shopping cart page UI

**Estimate:** 3 points

**Depends on:** FE-01, FE-02

Includes:

- Cart item rows
- Quantity controls
- Remove action
- Order summary
- AUD totals
- Empty-cart state
- Responsive layout

Acceptance criteria:

- Mock cart actions update the interface.
- Quantity cannot become negative.
- Empty and populated cart layouts work correctly.

## Phase 2: Product and Cart Integration

### INT-01: Build typed Supabase catalog data layer

**Estimate:** 3 points

Includes:

- Typed query functions using `lib/database.types.ts`
- Products, category hierarchy, sizes, tags, and cross-sell queries
- Flattened `product_catalog` view and `match_products` semantic-search RPC
- Standardised query errors
- Separation between data and presentation components

Acceptance criteria:

- UI components do not query Supabase directly.
- Only available products are exposed to the interface.
- Query errors use a consistent format.

### INT-02: Integrate landing page with product data

**Estimate:** 3 points

**Depends on:** FE-03, INT-01

Includes:

- Replace mock listing data
- Connect filtering and sorting
- Product count
- Pagination or load more
- Loading, error, and empty states

Acceptance criteria:

- Filters return matching Supabase products.
- Unavailable products never appear.
- Failed requests can be retried.

### INT-03: Integrate product details and recommendations

**Estimate:** 3 points

**Depends on:** FE-05, INT-01

Includes:

- Product lookup by `product_id`
- Category, size, stock, and tag data
- Product image resolution
- Cross-sell recommendation rules
- Not-found handling

Acceptance criteria:

- Product details come from Supabase.
- Unknown or inactive products show a not-found state.
- Recommendations contain only valid available products.

### INT-04: Implement anonymous cart state and persistence

**Estimate:** 3 points

**Depends on:** FE-05, FE-06, INT-01

Includes:

- Add, remove, update, and clear operations
- Product-and-size item identity
- Local browser persistence
- Navbar cart count
- Cart page connection
- Price and stock revalidation

Acceptance criteria:

- The cart survives a browser refresh.
- Adding the same product and size updates its quantity.
- Current price and stock are checked when loading the cart.
- Cart data is isolated to the current browser.

## Phase 3: MVP Validation

### QA-01: Frontend accessibility and responsive testing

**Estimate:** 3 points

Includes:

- Mobile, tablet, and desktop testing
- Keyboard and focus behaviour
- Labels and image alternative text
- Colour contrast
- Chrome, Safari, and Firefox
- Loading, error, empty, and missing-image states

Acceptance criteria:

- No critical accessibility or responsive defects remain.

### QA-02: End-to-end MVP testing and release fixes

**Estimate:** 3 points

Validate this journey:

```text
Open landing page
→ browse and filter products
→ ask the assistant
→ open a recommended product
→ select size and quantity
→ add to cart
→ update or remove cart items
```

Acceptance criteria:

- The complete journey works without authentication.
- No unavailable products appear.
- Critical defects are fixed.
- Lint and build checks pass.

## Delivery Summary

- 14 Jira tasks
- 40 total points (40 person-days)
- Approximately 14 working days with three contributors if work is evenly
  divided and dependencies allow parallel delivery
- Expected MVP duration: 3–4 weeks, including reviews and coordination

Suggested ownership:

- Contributor 1: shared components, landing page, and product listing
- Contributor 2: product details, cart UI, and responsive behaviour
- Contributor 3: Supabase data, cart integration, and AI integration

Agree on shared component interfaces and the AI API contract before beginning
integration work.
