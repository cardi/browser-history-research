.PHONY: all clean lint

history-research-unsigned.xpi: src/*
	7z a -tzip -xr\!docs -xr\!_* -xr\!.* $@ ./src/* ./LICENSE ./README.md

all: %.xpi

clean:
	$(RM) history-research-*.xpi

lint:
	web-ext lint --ignore-files "**/_*" --source-dir=./src

# vim: set noexpandtab ts=2 sw=2 tw=72:
