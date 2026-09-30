# URL Creation Specification

## Purpose

Enable visitors to create a shareable short URL from a destination URL, see the generated link, and follow it to the destination.

## Requirements

### Requirement: URL creation form

The system SHALL provide visitors with a URL creation form containing a destination URL field and a button labeled **Shorten URL**.

#### Scenario: Visitor views the URL creation form

```gherkin
Given a visitor has opened the URL creation form
When the visitor views the form
Then a destination URL field is visible
And a button labeled "Shorten URL" is visible
```

### Requirement: Short URL generation

The system SHALL generate a short URL for the destination URL when a visitor enters a valid destination URL and chooses **Shorten URL**.

#### Scenario: Visitor creates a short URL for a destination

```gherkin
Given a visitor has opened the URL creation form
And the visitor has entered "https://www.manning.com/books/spec-driven-development" in the destination URL field
When the visitor chooses "Shorten URL"
Then URL creation completes successfully
And a short URL is generated for "https://www.manning.com/books/spec-driven-development"
```

### Requirement: Generated short URL display

The system SHALL display the generated short URL in a result area when URL creation completes successfully.

#### Scenario: Visitor sees the generated short URL

```gherkin
Given a visitor has opened the URL creation form
And the visitor has entered "https://www.manning.com/books/spec-driven-development" in the destination URL field
When the visitor chooses "Shorten URL"
And URL creation completes successfully
Then the result area displays the short URL generated for "https://www.manning.com/books/spec-driven-development"
```

### Requirement: Follow the generated short URL

The system SHALL make the displayed short URL selectable and SHALL navigate the visitor to its associated destination URL when the visitor follows it, preserving the destination path, query, and fragment.

#### Scenario: Visitor follows the displayed short URL to its destination

```gherkin
Given a visitor has opened the URL creation form
And the visitor has entered "https://www.manning.com/books/spec-driven-development" in the destination URL field
And the visitor has chosen "Shorten URL"
And URL creation has completed successfully
And the result area displays the generated short URL
When the visitor selects the displayed short URL
Then the visitor follows that short URL
And the browser navigates to "https://www.manning.com/books/spec-driven-development"
```
