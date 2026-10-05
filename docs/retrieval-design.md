# Source-backed search

`search_theory` searches the 600-question JSON bank only. It compares normalized Vietnamese text from questions, options, and available explanations, folding diacritics and `đ`, then ranks exact phrases and token matches. Each hit carries a `question-bank.json#qNNN` reference. When an explanation is missing, the excerpt is the source question text itself.

The result is retrieval evidence, not a generated legal answer. The tutor skill asks the model to cite a hit and to say when the bank lacks supporting material. This first local search uses no external corpus or model. Retrieval quality for ambiguous broad queries needs further evaluation before public release.
