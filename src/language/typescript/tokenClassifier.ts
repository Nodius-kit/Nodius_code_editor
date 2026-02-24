import ts from 'typescript';
import type { TokenKind } from '../types.js';

/**
 * Map a TypeScript SyntaxKind value to our editor TokenKind classification.
 */
export function classifySyntaxKind(kind: number): TokenKind {
  // Keywords: TypeScript keyword range is FirstKeyword..LastKeyword
  if (kind >= ts.SyntaxKind.FirstKeyword && kind <= ts.SyntaxKind.LastKeyword) {
    return 'keyword';
  }

  switch (kind) {
    // String literals
    case ts.SyntaxKind.StringLiteral:
    case ts.SyntaxKind.NoSubstitutionTemplateLiteral:
      return 'string';

    // Numeric literals
    case ts.SyntaxKind.NumericLiteral:
    case ts.SyntaxKind.BigIntLiteral:
      return 'number';

    // Comments (trivia kinds)
    case ts.SyntaxKind.SingleLineCommentTrivia:
    case ts.SyntaxKind.MultiLineCommentTrivia:
      return 'comment';

    // Template literals
    case ts.SyntaxKind.TemplateHead:
    case ts.SyntaxKind.TemplateMiddle:
    case ts.SyntaxKind.TemplateTail:
      return 'template';

    // Regular expression
    case ts.SyntaxKind.RegularExpressionLiteral:
      return 'regexp';

    // Identifier
    case ts.SyntaxKind.Identifier:
      return 'identifier';

    // Whitespace trivia
    case ts.SyntaxKind.WhitespaceTrivia:
    case ts.SyntaxKind.NewLineTrivia:
      return 'whitespace';

    // Operators
    case ts.SyntaxKind.PlusToken:
    case ts.SyntaxKind.MinusToken:
    case ts.SyntaxKind.AsteriskToken:
    case ts.SyntaxKind.SlashToken:
    case ts.SyntaxKind.PercentToken:
    case ts.SyntaxKind.AsteriskAsteriskToken:
    case ts.SyntaxKind.EqualsToken:
    case ts.SyntaxKind.EqualsEqualsToken:
    case ts.SyntaxKind.EqualsEqualsEqualsToken:
    case ts.SyntaxKind.ExclamationEqualsToken:
    case ts.SyntaxKind.ExclamationEqualsEqualsToken:
    case ts.SyntaxKind.LessThanToken:
    case ts.SyntaxKind.GreaterThanToken:
    case ts.SyntaxKind.LessThanEqualsToken:
    case ts.SyntaxKind.GreaterThanEqualsToken:
    case ts.SyntaxKind.AmpersandToken:
    case ts.SyntaxKind.AmpersandAmpersandToken:
    case ts.SyntaxKind.BarToken:
    case ts.SyntaxKind.BarBarToken:
    case ts.SyntaxKind.CaretToken:
    case ts.SyntaxKind.TildeToken:
    case ts.SyntaxKind.ExclamationToken:
    case ts.SyntaxKind.LessThanLessThanToken:
    case ts.SyntaxKind.GreaterThanGreaterThanToken:
    case ts.SyntaxKind.GreaterThanGreaterThanGreaterThanToken:
    case ts.SyntaxKind.PlusEqualsToken:
    case ts.SyntaxKind.MinusEqualsToken:
    case ts.SyntaxKind.AsteriskEqualsToken:
    case ts.SyntaxKind.SlashEqualsToken:
    case ts.SyntaxKind.PercentEqualsToken:
    case ts.SyntaxKind.AsteriskAsteriskEqualsToken:
    case ts.SyntaxKind.LessThanLessThanEqualsToken:
    case ts.SyntaxKind.GreaterThanGreaterThanEqualsToken:
    case ts.SyntaxKind.GreaterThanGreaterThanGreaterThanEqualsToken:
    case ts.SyntaxKind.AmpersandEqualsToken:
    case ts.SyntaxKind.BarEqualsToken:
    case ts.SyntaxKind.CaretEqualsToken:
    case ts.SyntaxKind.PlusPlusToken:
    case ts.SyntaxKind.MinusMinusToken:
    case ts.SyntaxKind.QuestionToken:
    case ts.SyntaxKind.QuestionQuestionToken:
    case ts.SyntaxKind.QuestionDotToken:
    case ts.SyntaxKind.DotDotDotToken:
    case ts.SyntaxKind.EqualsGreaterThanToken:
    case ts.SyntaxKind.ColonToken:
      return 'operator';

    // Punctuation
    case ts.SyntaxKind.OpenBraceToken:
    case ts.SyntaxKind.CloseBraceToken:
    case ts.SyntaxKind.OpenParenToken:
    case ts.SyntaxKind.CloseParenToken:
    case ts.SyntaxKind.OpenBracketToken:
    case ts.SyntaxKind.CloseBracketToken:
    case ts.SyntaxKind.DotToken:
    case ts.SyntaxKind.SemicolonToken:
    case ts.SyntaxKind.CommaToken:
    case ts.SyntaxKind.AtToken:
      return 'punctuation';

    // Backtick is part of template literal syntax
    case ts.SyntaxKind.BacktickToken:
      return 'template';

    default:
      return 'plain';
  }
}
